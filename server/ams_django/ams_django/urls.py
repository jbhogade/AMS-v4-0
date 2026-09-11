"""URL configuration for the AMS-Test Django backend.

/api/* routes come first (mirroring the .NET controllers); everything else is
the static frontend served same-origin from the AMS-Test root.
"""

from django.urls import include, path, re_path

from ams import views

urlpatterns = [
    path("", include("ams.urls")),
    path("index.html", views.index, name="index"),
    path("pages/<str:name>", views.page, name="page"),
    re_path(r"^(?P<path>.*)$", views.asset, name="asset"),
]
