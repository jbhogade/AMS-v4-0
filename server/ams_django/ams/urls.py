from django.urls import path

from . import views

urlpatterns = [
    path("api/auth/login", views.login, name="login"),
    path("api/auth/me", views.me, name="me"),
    path("api/auth/users", views.users, name="users"),
    path("api/auth/users/<str:username>", views.user_detail, name="user_detail"),
    path("api/collection/<str:key>", views.collection, name="collection"),
    path("api/health", views.health, name="health"),
]
