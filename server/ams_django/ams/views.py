"""API + frontend views for the AMS-Test Django backend.

Endpoint behavior (status codes, payloads, role gates, error messages) mirrors
server/AMS.API/Controllers so the frontend is fully interchangeable between the
.NET API and this Django backend.
"""

import json
import logging
import os
from functools import wraps

import pyodbc
from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse, JsonResponse

from . import crypto
from .db import ALLOWED_KEYS, CollectionSaveError, get_db

logger = logging.getLogger(__name__)

DB_UNAVAILABLE_MSG = (
    "Database unavailable. Check that SQL Server is running and run "
    "database/Setup-AMS-TEST.bat, then restart the API."
)
ROOT_ROLES = ("Super Root", "Supreme Root")
MAX_COLLECTION_BYTES = 16_000_000


def _db_error():
    return JsonResponse({"error": DB_UNAVAILABLE_MSG}, status=503)


def _body_json(request):
    """Parse a JSON request body -> (dict|list|None, error_response)."""
    try:
        return json.loads(request.body or b"{}"), None
    except ValueError:
        return None, JsonResponse({"error": "Invalid JSON body."}, status=400)


def require_auth(view):
    @wraps(view)
    def wrapper(request, *args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return JsonResponse({"error": "Unauthorized."}, status=401)
        try:
            claims = crypto.validate_token(auth[7:].strip(), settings)
        except Exception:
            return JsonResponse({"error": "Unauthorized."}, status=401)
        request.username = claims.get("nameidentifier") or claims.get("sub") or ""
        request.role = claims.get("role", "")
        return view(request, *args, **kwargs)

    return wrapper


def profile_dict(user):
    name = user["display_name"] or user["linked_employee"] or user["username"]
    return {
        "username": user["username"],
        "role": user["role"],
        "name": name,
        "displayName": user["display_name"],
        "linkedEmployee": user["linked_employee"],
        "email": user["email"],
        "contactNo": user["contact_no"],
        "address": user["address"],
        "dob": user["dob"],
        "gender": user["gender"],
        "remarks": user["remarks"],
    }


def user_summary(user):
    return {
        "username": user["username"],
        "role": user["role"],
        "displayName": user["display_name"],
        "linkedEmployee": user["linked_employee"],
        "email": user["email"],
        "remarks": user["remarks"],
        "active": user["active"],
    }


def is_root(role):
    return role in ROOT_ROLES


# ---- /api/auth ---------------------------------------------------------------


def login(request):
    if request.method != "POST":
        return HttpResponse(status=405)
    body, err = _body_json(request)
    if err:
        return err
    body = body if isinstance(body, dict) else {}
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""
    if not username or not password:
        return JsonResponse({"error": "Username and password are required."}, status=400)
    try:
        db = get_db()
        user = db.find_user(username)
    except pyodbc.Error:
        return _db_error()
    if user is None or not user["active"]:
        return JsonResponse({"error": "Invalid username or password."}, status=401)
    if not db.verify_password(user, password):
        return JsonResponse({"error": "Invalid username or password."}, status=401)
    name = user["display_name"] or user["linked_employee"] or user["username"]
    token = crypto.create_token(user["username"], user["role"], name, settings)
    return JsonResponse({
        "token": token,
        "username": user["username"],
        "role": user["role"],
        "name": name,
        "displayName": name,
        "linkedEmployee": user["linked_employee"],
        "email": user["email"],
        "contactNo": user["contact_no"],
        "address": user["address"],
        "dob": user["dob"],
        "gender": user["gender"],
    })


@require_auth
def me(request):
    try:
        db = get_db()
        user = db.find_user(request.username)
    except pyodbc.Error:
        return _db_error()
    if user is None:
        return JsonResponse({"error": "Unauthorized."}, status=401)

    if request.method == "GET":
        return JsonResponse(profile_dict(user))

    if request.method != "PUT":
        return HttpResponse(status=405)

    body, err = _body_json(request)
    if err:
        return err
    body = body if isinstance(body, dict) else {}

    if (body.get("newPassword") or "").strip():
        if not (body.get("currentPassword") or "").strip() or not db.verify_password(user, body["currentPassword"]):
            return JsonResponse({"error": "Current password is incorrect."}, status=400)

    email = body.get("email")
    if email is None or not str(email).strip():
        email = user["email"]
    else:
        email = str(email).strip()

    db.update_user(
        username=request.username,
        new_password=body.get("newPassword") or None,
        role=None,
        linked_employee=user["linked_employee"],
        email=email,
        remarks=user["remarks"],
        active=None,
        display_name=body.get("displayName") if body.get("displayName") is not None else None,
        contact_no=body.get("contactNo"),
        address=body.get("address"),
        dob=body.get("dob"),
        gender=body.get("gender"),
    )
    updated = db.find_user(request.username)
    return JsonResponse(profile_dict(updated or user))


@require_auth
def users(request):
    try:
        db = get_db()
    except pyodbc.Error:
        return _db_error()

    if request.method == "GET":
        if not is_root(request.role):
            return HttpResponse(status=403)
        try:
            return JsonResponse([user_summary(u) for u in db.list_users()], safe=False)
        except pyodbc.Error:
            return _db_error()

    if request.method != "POST":
        return HttpResponse(status=405)

    if not is_root(request.role):
        return HttpResponse(status=403)
    body, err = _body_json(request)
    if err:
        return err
    body = body if isinstance(body, dict) else {}

    role = body.get("role") or ""
    if role == "Supreme Root" and request.role != "Supreme Root":
        return HttpResponse(status=403)

    username = (body.get("username") or "").strip()
    if not username or not str(body.get("password") or "").strip():
        return JsonResponse({"error": "Username and password are required."}, status=400)

    try:
        existing = db.find_user(username)
        if existing is not None:
            return JsonResponse({"error": f"Username '{username}' already exists."}, status=409)
        db.create_user(
            username=username,
            password=body["password"],
            role=role,
            linked_employee=body.get("linkedEmployee"),
            email=body.get("email"),
            remarks=body.get("remarks"),
            active=body.get("active", True),
        )
        return JsonResponse({"ok": True, "username": username, "role": role})
    except pyodbc.Error:
        return _db_error()


@require_auth
def user_detail(request, username):
    if not is_root(request.role):
        return HttpResponse(status=403)
    try:
        db = get_db()
        user = db.find_user(username)
    except pyodbc.Error:
        return _db_error()
    if user is None:
        return JsonResponse({"error": f"User '{username}' not found."}, status=404)

    if request.method == "PUT":
        body, err = _body_json(request)
        if err:
            return err
        body = body if isinstance(body, dict) else {}
        role = body.get("role")
        if (user["role"] == "Supreme Root" or role == "Supreme Root") and request.role != "Supreme Root":
            return HttpResponse(status=403)
        try:
            db.update_user(
                username=username,
                new_password=body.get("password") or None,
                role=role,
                linked_employee=body.get("linkedEmployee"),
                email=body.get("email"),
                remarks=body.get("remarks"),
                active=body.get("active"),
                display_name=body.get("displayName"),
                contact_no=body.get("contactNo"),
                address=body.get("address"),
                dob=body.get("dob"),
                gender=body.get("gender"),
            )
            return JsonResponse({"ok": True, "username": username})
        except pyodbc.Error:
            return _db_error()

    if request.method == "DELETE":
        if user["role"] == "Supreme Root":
            return HttpResponse(status=403)
        if user["role"] == "Super Root" and request.role != "Supreme Root":
            return HttpResponse(status=403)
        try:
            db.delete_user(username)
            return JsonResponse({"ok": True, "username": username})
        except pyodbc.Error:
            return _db_error()

    return HttpResponse(status=405)


# ---- /api/collection ---------------------------------------------------------


@require_auth
def collection(request, key):
    if key not in ALLOWED_KEYS:
        return JsonResponse({"error": f"Unknown collection: {key}"}, status=404)
    try:
        db = get_db()
        if request.method == "GET":
            stored = db.get_collection(key)
            if not stored or not stored.strip():
                return HttpResponse("[]", content_type="application/json; charset=utf-8")
            return HttpResponse(stored, content_type="application/json; charset=utf-8")

        if request.method == "DELETE":
            db.save_collection(key, "[]")
            return JsonResponse({"ok": True, "collection": key, "count": 0})

        if request.method != "PUT":
            return HttpResponse(status=405)

        if len(request.body) > MAX_COLLECTION_BYTES:
            return JsonResponse({"error": "Payload too large."}, status=400)
        body, err = _body_json(request)
        if err:
            return err
        if not isinstance(body, (dict, list)):
            return JsonResponse({"error": "Body must be a JSON array or object."}, status=400)

        db.save_collection(key, request.body.decode("utf-8", errors="replace"))
        return JsonResponse({"ok": True, "collection": key})
    except CollectionSaveError as ex:
        return JsonResponse({"error": str(ex)}, status=409)
    except pyodbc.Error:
        return _db_error()


# ---- /api/health -------------------------------------------------------------


def health(request):
    return JsonResponse({"ok": True, "app": "AMS-Test API", "database": "AMS-TEST"})


# ---- frontend serving (same-origin, mirrors .NET UseStaticFiles) -------------


def _safe_path(rel):
    root = os.path.realpath(settings.FRONTEND_ROOT)
    target = os.path.realpath(os.path.join(root, rel))
    if target != root and not target.startswith(root + os.sep):
        return None
    return target


def _serve_file(request, rel):
    path = _safe_path(rel)
    if path is None or not os.path.isfile(path):
        raise Http404
    return FileResponse(open(path, "rb"))


def index(request):
    return _serve_file(request, "index.html")


def page(request, name):
    if not name or ".." in name or "/" in name:
        raise Http404
    return _serve_file(request, os.path.join("pages", name))


def asset(request, path):
    if path == "":
        return _serve_file(request, "index.html")
    if path.endswith("/"):
        raise Http404
    return _serve_file(request, path)
