"""Ejemplo de LozCharts con Django + HTMX: un tablero con filtro por región.

La vista arma las opciones del gráfico como un diccionario de Python. La plantilla las pasa con
`json_script` (seguro: escapa todo) y LozCharts las lee. Con HTMX, el filtro pide solo el
fragmento del tablero y lo reemplaza; LozChart.initAll crea los gráficos nuevos.
"""
from django.db.models import Sum
from django.db.models.functions import TruncMonth
from django.shortcuts import render

from .models import Venta  # Venta(fecha, region, canal, monto): un modelo de ejemplo


def tablero(request):
    region = request.GET.get("region", "Norte")
    ventas = Venta.objects.filter(region=region, fecha__year=2026)

    por_mes = (
        ventas.annotate(mes=TruncMonth("fecha"))
        .values("mes", "canal")
        .annotate(total=Sum("monto"))
        .order_by("mes")
    )
    filas = {}
    for v in por_mes:
        fila = filas.setdefault(v["mes"].strftime("%Y-%m"), {"mes": v["mes"].strftime("%Y-%m")})
        fila[v["canal"]] = float(v["total"])

    opciones = {
        "title": f"Ventas mensuales · {region}",
        "data": list(filas.values()),
        "xAxis": {"field": "mes", "type": "time"},
        "yAxis": {"format": "currency"},
        "series": [
            {"type": "bar", "field": "Online", "name": "Online", "stack": True},
            {"type": "bar", "field": "Tienda", "name": "Tienda", "stack": True},
        ],
        "annotations": [{"y": 80000, "label": "Meta"}],
    }
    contexto = {"region": region, "opciones": opciones, "regiones": ["Norte", "Centro", "Sur"]}
    # Con HTMX se devuelve solo el fragmento; sin HTMX (primera carga), la página completa.
    plantilla = "ventas/_tablero.html" if request.headers.get("HX-Request") else "ventas/tablero.html"
    return render(request, plantilla, contexto)
