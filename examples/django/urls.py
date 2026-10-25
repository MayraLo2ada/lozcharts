from django.urls import path

from . import views

urlpatterns = [path("ventas/", views.tablero, name="tablero")]
