# LozCharts con Django + HTMX

Archivos de ejemplo para una app de Django (`ventas`):

- `views.py`: la vista arma las opciones del gráfico con datos del ORM y devuelve la página
  completa o, si la pide HTMX (`HX-Request`), solo el fragmento.
- `urls.py`: la ruta `/ventas/`.
- `templates/ventas/tablero.html`: la página, con los botones de región (`hx-get`) y los scripts.
- `templates/ventas/_tablero.html`: el fragmento. Las opciones van con `json_script`, que las
  escapa (nunca pongas datos en el HTML sin escapar).

Copia `dist/lozcharts.umd.js` (después de `npm run build`) a la carpeta `static/` de la app.

Las dos líneas que conectan LozCharts con HTMX:

```js
htmx.onLoad((el) => LozChart.initAll(el)); // crea los gráficos de cada fragmento nuevo
document.body.addEventListener('htmx:beforeSwap', (e) => LozChart.destroyAll(e.detail.target));
```

Para verlo funcionar sin Django, abre `examples/htmx/index.html` con un servidor local: hace lo
mismo con fragmentos estáticos.

`<loz-chart options='…'>` también sirve dentro de los fragmentos: se crea y se destruye solo.
