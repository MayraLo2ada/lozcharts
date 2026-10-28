/*
 * Ejemplos de gráficos por capas, en los tres idiomas: los usan la página «Crea el tuyo», la
 * galería y qa/capas.html. capasEjemplos('es' | 'en' | 'pt') devuelve la lista con sus textos, los
 * nombres de los campos y los datos en ese idioma. Los datos son inventados y siempre iguales.
 */
(function (raiz) {
  'use strict';

  var LOCALE = { es: 'es', en: 'en', pt: 'pt-BR' };

  function crear(idioma) {
    if (idioma !== 'en' && idioma !== 'pt') idioma = 'es';
    var t = function (o) {
      return o[idioma];
    };
    /** { clave: ancho, … } con claves que dependen del idioma: widthsDe('Racha', 3, 'Total', 2). */
    var widthsDe = function () {
      var w = {};
      for (var k = 0; k < arguments.length; k += 2) w[arguments[k]] = arguments[k + 1];
      return w;
    };

    // ------------------------------------------------------------ Hábitos de un mes

    var H = t({
      es: { habito: 'habito', racha: 'racha', dia: 'dia', hecho: 'hecho', columna: 'Racha' },
      en: { habito: 'habit', racha: 'streak', dia: 'day', hecho: 'done', columna: 'Streak' },
      pt: { habito: 'habito', racha: 'sequencia', dia: 'dia', hecho: 'feito', columna: 'Sequência' },
    });
    var habitos = t({
      es: ['Leer 20 minutos', 'Caminar', 'Tomar agua', 'Meditar', 'Dormir antes de las 11'],
      en: ['Read 20 minutes', 'Take a walk', 'Drink water', 'Meditate', 'Bed before 11'],
      pt: ['Ler 20 minutos', 'Caminhar', 'Beber água', 'Meditar', 'Dormir antes das 23h'],
    });
    var marcas = [
      ['1111111111111011101011111111111', 13],
      ['1111101111100111001011011100101', 5],
      ['1111101111101111111111111111111', 19],
      ['0111001111001111000000100001110', 4],
      ['1111111111100111110011111101101', 11],
    ];
    var dias = [];
    for (var d = 1; d <= 31; d++) dias.push(String(d));
    var mes = habitos.map(function (nombre, k) {
      var fila = {};
      fila[H.habito] = nombre;
      fila[H.racha] = marcas[k][1];
      dias.forEach(function (dia, i) {
        fila[dia] = Number(marcas[k][0][i]);
      });
      return fila;
    });
    var hecho = H.hecho + ' == 1';
    var habitosSpec = {
      title: t({ es: 'Mi octubre, hábito por hábito', en: 'My October, habit by habit', pt: 'Meu outubro, hábito por hábito' }),
      subtitle: t({
        es: 'Cada cuadro es un día que lo cumplí. La racha es la serie más larga sin fallar.',
        en: 'Each square is a day I kept it. The streak is my longest run without missing a day.',
        pt: 'Cada quadrado é um dia em que eu cumpri. A sequência é a mais longa sem falhar.',
      }),
      locale: LOCALE[idioma],
      data: {
        mes: mes,
        dias: { from: 'mes', fold: dias, as: [H.dia, H.hecho] },
      },
      scales: { x: { axis: 'top', widths: widthsDe(H.columna, 3) } },
      layers: [
        {
          mark: 'cell',
          data: 'dias',
          x: H.dia,
          y: H.habito,
          color: { if: hecho, then: 'violet', else: 'grid' },
          alt: {
            if: hecho,
            then: t({ es: 'Lo hice', en: 'Done', pt: 'Feito' }),
            else: t({ es: 'No lo hice', en: 'Missed', pt: 'Não fiz' }),
          },
          tooltip: [],
        },
        {
          mark: 'icon',
          data: 'dias',
          filter: hecho,
          x: H.dia,
          y: H.habito,
          icon: 'check',
          size: 14,
          alt: t({ es: 'Lo hice', en: 'Done', pt: 'Feito' }),
          tooltip: false,
        },
        {
          mark: 'icon',
          data: 'mes',
          x: { value: H.columna },
          y: H.habito,
          icon: { if: H.racha + ' >= 10', then: 'fire', else: 'dot' },
          color: { if: H.racha + ' >= 10', then: 'coral', else: 'muted' },
          size: { if: H.racha + ' >= 10', then: 16, else: 7 },
          position: 'left',
          alt: {
            if: H.racha + ' >= 10',
            then: t({
              es: 'Racha de {' + H.racha + '} días',
              en: '{' + H.racha + '}-day streak',
              pt: 'Sequência de {' + H.racha + '} dias',
            }),
            else: t({ es: 'Racha corta', en: 'Short streak', pt: 'Sequência curta' }),
          },
          title: '{' + H.habito + '}',
          tooltip: [H.racha],
        },
        {
          mark: 'text',
          data: 'mes',
          x: { value: H.columna },
          y: H.habito,
          text: '{' + H.racha + '}',
          position: 'right',
          weight: 'bold',
        },
      ],
    };

    // ------------------------------------------------------------ Notas de un curso

    var N = t({
      es: {
        estudiante: 'estudiante',
        materia: 'materia',
        nota: 'nota',
        parcial: 'parcial',
        promedio: 'Promedio',
        tendencia: 'Tendencia',
      },
      en: { estudiante: 'student', materia: 'subject', nota: 'grade', parcial: 'quiz', promedio: 'Average', tendencia: 'Trend' },
      pt: {
        estudiante: 'estudante',
        materia: 'materia',
        nota: 'nota',
        parcial: 'prova',
        promedio: 'Média',
        tendencia: 'Tendência',
      },
    });
    var materias = t({
      es: ['Matemáticas', 'Lengua', 'Ciencias', 'Historia', 'Inglés'],
      en: ['Math', 'Reading', 'Science', 'History', 'Spanish'],
      pt: ['Matemática', 'Português', 'Ciências', 'História', 'Inglês'],
    });
    var parciales = ['P1', 'P2', 'P3', 'P4'];
    var estudiantes = ['Ana', 'Bruno', 'Camila', 'Diego', 'Elena', 'Felipe', 'Gabriela', 'Hugo'];
    var calificaciones = [
      [
        [7.2, 8.3, 7.7, 8.5, 8.5],
        [7.4, 6.8, 7.0, 8.0],
      ],
      [
        [5.9, 7.1, 5.9, 6.5, 4.8],
        [6.3, 6.8, 7.1, 6.7],
      ],
      [
        [9.9, 9.3, 8.3, 7.4, 10],
        [9.3, 9.4, 10, 9.8],
      ],
      [
        [6.1, 4.9, 6.6, 6.4, 3.7],
        [4.7, 4.3, 4.8, 4.6],
      ],
      [
        [7.3, 6.9, 6.8, 7.6, 7.6],
        [8.7, 8.6, 8.7, 8.3],
      ],
      [
        [3.4, 5.7, 6.1, 5.9, 4.7],
        [5.3, 4.8, 4.2, 3.7],
      ],
      [
        [9.9, 10, 7.3, 9.7, 8.4],
        [8.1, 8.5, 7.8, 8.8],
      ],
      [
        [5.0, 7.2, 5.9, 7.8, 8.1],
        [6.2, 6.4, 7.6, 7.4],
      ],
    ];
    var curso = estudiantes.map(function (nombre, k) {
      var fila = {};
      fila[N.estudiante] = nombre;
      materias.forEach(function (m, j) {
        fila[m] = calificaciones[k][0][j];
      });
      parciales.forEach(function (p, j) {
        fila[p] = calificaciones[k][1][j];
      });
      return fila;
    });
    // El promedio es una cuenta con los campos: así se ve que una expresión puede hacer más que comparar.
    var promedio = 'round((' + materias.join(' + ') + ') / ' + materias.length + ', 1)';
    var decimal = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
    var notasSpec = {
      title: t({ es: 'Las notas del primer trimestre', en: 'First-term grades', pt: 'As notas do primeiro bimestre' }),
      subtitle: t({
        es: 'Del 1 al 10, se aprueba con 6. Cada materia se colorea contra sí misma; la tendencia sigue los cuatro parciales.',
        en: 'From 1 to 10, and 6 is a pass. Each subject is colored against itself; the trend follows the four quizzes.',
        pt: 'De 1 a 10, e passa quem tira 6. Cada matéria é colorida em relação a si mesma; a tendência segue as quatro provas.',
      }),
      locale: LOCALE[idioma],
      data: {
        curso: curso,
        materias: { from: 'curso', fold: materias, as: [N.materia, N.nota] },
        parciales: { from: 'curso', fold: parciales, as: [N.parcial, N.nota] },
      },
      scales: { x: { axis: 'top', widths: widthsDe(N.tendencia, 1.6, N.promedio, 1.2) } },
      layers: [
        {
          mark: 'cell',
          data: 'materias',
          x: N.materia,
          y: N.estudiante,
          color: { field: N.nota, scale: 'traffic-light', by: 'column' },
          tooltip: [N.nota],
        },
        { mark: 'text', data: 'materias', x: N.materia, y: N.estudiante, text: '{' + N.nota + '}', format: decimal },
        {
          mark: 'text',
          data: 'curso',
          x: { value: N.promedio },
          y: N.estudiante,
          text: '{' + promedio + '}',
          format: decimal,
          position: 'right',
          weight: 'bold',
        },
        {
          mark: 'icon',
          data: 'curso',
          x: { value: N.promedio },
          y: N.estudiante,
          position: 'left',
          size: 26,
          icon: { if: promedio + ' >= 6', then: 'smile', else: 'sad' },
          color: { if: promedio + ' >= 6', then: 'good', else: 'bad' },
          alt: {
            if: promedio + ' >= 6',
            then: t({
              es: 'Aprueba con {' + promedio + '}',
              en: 'Passes with {' + promedio + '}',
              pt: 'Passa com {' + promedio + '}',
            }),
            else: t({
              es: 'No aprueba: {' + promedio + '}',
              en: "Doesn't pass: {" + promedio + '}',
              pt: 'Não passa: {' + promedio + '}',
            }),
          },
          title: '{' + N.estudiante + '} · ' + N.promedio,
          tooltip: false,
        },
        {
          mark: 'spark',
          data: 'parciales',
          x: { value: N.tendencia },
          y: N.estudiante,
          period: N.parcial,
          value: N.nota,
          area: true,
          extremes: true,
          format: decimal,
        },
      ],
    };

    // ------------------------------------------------------------ El clima de la semana

    var C = t({
      es: { ciudad: 'ciudad', dia: 'dia', cielo: 'cielo', max: 'maxima' },
      en: { ciudad: 'city', dia: 'day', cielo: 'sky', max: 'high' },
      pt: { ciudad: 'cidade', dia: 'dia', cielo: 'ceu', max: 'maxima' },
    });
    var semana = t({
      es: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
      en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      pt: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
    });
    // Cómo se dice el cielo en cada idioma: los datos lo traen así y la tabla de "map" lo vuelve ícono.
    var CIELO = t({
      es: { sun: 'sol', partly: 'parcial', cloud: 'nublado', rain: 'lluvia', storm: 'tormenta' },
      en: { sun: 'sunny', partly: 'partly cloudy', cloud: 'cloudy', rain: 'rain', storm: 'storm' },
      pt: { sun: 'sol', partly: 'parcial', cloud: 'nublado', rain: 'chuva', storm: 'tempestade' },
    });
    var ciudades = [
      ['Lima', 'partly cloud cloud partly sun partly cloud', [20, 20, 21, 22, 22, 22, 16]],
      ['Bogotá', 'rain partly rain storm partly sun rain', [17, 22, 18, 19, 17, 21, 15]],
      [
        t({ es: 'Ciudad de México', en: 'Mexico City', pt: 'Cidade do México' }),
        'sun sun partly storm rain partly sun',
        [28, 28, 23, 22, 23, 28, 30],
      ],
      ['Madrid', 'sun sun sun partly cloud sun sun', [23, 27, 23, 24, 21, 22, 27]],
      ['São Paulo', 'storm rain partly sun sun partly rain', [23, 23, 30, 31, 28, 30, 25]],
      ['Buenos Aires', 'cloud rain rain partly sun sun partly', [22, 17, 22, 22, 26, 25, 20]],
    ];
    var clima = [];
    ciudades.forEach(function (c) {
      c[1].split(' ').forEach(function (cielo, i) {
        var fila = {};
        fila[C.ciudad] = c[0];
        fila[C.dia] = semana[i];
        fila[C.cielo] = CIELO[cielo];
        fila[C.max] = c[2][i];
        clima.push(fila);
      });
    });
    var iconos = {};
    Object.keys(CIELO).forEach(function (k) {
      iconos[CIELO[k]] = k;
    });
    var climaSpec = {
      title: t({
        es: 'Una semana de clima en seis ciudades',
        en: 'A week of weather in six cities',
        pt: 'Uma semana de clima em seis cidades',
      }),
      subtitle: t({
        es: 'La máxima de cada día en °C y cómo estuvo el cielo. Cuanto más intenso el color, más calor.',
        en: 'Each day’s high in °C and what the sky looked like. The deeper the color, the warmer it was.',
        pt: 'A máxima de cada dia em °C e como estava o céu. Quanto mais intensa a cor, mais calor.',
      }),
      locale: LOCALE[idioma],
      data: clima,
      scales: { x: { axis: 'top' } },
      layers: [
        {
          mark: 'cell',
          x: C.dia,
          y: C.ciudad,
          color: { field: C.max, scale: 'sequential' },
          alt: '{' + C.cielo + '}, {' + C.max + '} °C',
          tooltip: [],
        },
        {
          mark: 'icon',
          x: C.dia,
          y: C.ciudad,
          icon: { field: C.cielo, map: iconos },
          size: 18,
          position: 'top',
          tooltip: false,
        },
        { mark: 'text', x: C.dia, y: C.ciudad, text: '{' + C.max + '}°', position: 'bottom', weight: 'bold' },
      ],
    };

    // ------------------------------------------------------------ Viajes por el mundo

    var V = t({
      es: { ciudad: 'ciudad', anio: 'anio', favorita: 'favorita' },
      en: { ciudad: 'city', anio: 'year', favorita: 'favorite' },
      pt: { ciudad: 'cidade', anio: 'ano', favorita: 'favorita' },
    });
    var lugares = [
      [{ es: 'Lima', en: 'Lima', pt: 'Lima' }, -12.05, -77.04, 2019, false],
      [{ es: 'Cusco', en: 'Cusco', pt: 'Cusco' }, -13.53, -71.97, 2019, true],
      [{ es: 'Ciudad de México', en: 'Mexico City', pt: 'Cidade do México' }, 19.43, -99.13, 2020, true],
      [{ es: 'Nueva York', en: 'New York', pt: 'Nova York' }, 40.71, -74.0, 2021, false],
      [{ es: 'Lisboa', en: 'Lisbon', pt: 'Lisboa' }, 38.72, -9.14, 2022, true],
      [{ es: 'Madrid', en: 'Madrid', pt: 'Madri' }, 40.42, -3.7, 2022, false],
      [{ es: 'París', en: 'Paris', pt: 'Paris' }, 48.86, 2.35, 2022, false],
      [{ es: 'Roma', en: 'Rome', pt: 'Roma' }, 41.9, 12.5, 2023, false],
      [{ es: 'Marrakech', en: 'Marrakesh', pt: 'Marrakech' }, 31.63, -7.99, 2023, true],
      [{ es: 'El Cairo', en: 'Cairo', pt: 'Cairo' }, 30.04, 31.24, 2024, false],
      [{ es: 'Tokio', en: 'Tokyo', pt: 'Tóquio' }, 35.68, 139.69, 2024, true],
      [{ es: 'Kioto', en: 'Kyoto', pt: 'Quioto' }, 35.01, 135.77, 2024, false],
      [{ es: 'Bangkok', en: 'Bangkok', pt: 'Bangkok' }, 13.76, 100.5, 2025, false],
      [{ es: 'Sídney', en: 'Sydney', pt: 'Sydney' }, -33.87, 151.21, 2025, false],
      [{ es: 'Buenos Aires', en: 'Buenos Aires', pt: 'Buenos Aires' }, -34.6, -58.38, 2026, true],
      [{ es: 'Río de Janeiro', en: 'Rio de Janeiro', pt: 'Rio de Janeiro' }, -22.91, -43.17, 2026, false],
    ];
    var viajes = lugares.map(function (l) {
      var fila = {};
      fila[V.ciudad] = t(l[0]);
      fila.lat = l[1];
      fila.lon = l[2];
      fila[V.anio] = l[3];
      fila[V.favorita] = l[4];
      return fila;
    });
    var viajesSpec = {
      title: t({ es: 'Los viajes de Sofía', en: 'Sofia’s trips', pt: 'As viagens da Sofia' }),
      subtitle: t({
        es: 'Dieciséis ciudades en ocho años. Las estrellas son las que ella repetiría.',
        en: 'Sixteen cities in eight years. The stars are the ones she’d go back to.',
        pt: 'Dezesseis cidades em oito anos. As estrelas são as que ela repetiria.',
      }),
      locale: LOCALE[idioma],
      geo: { map: 'mundo', fit: 'all' },
      data: viajes,
      layers: [
        {
          mark: 'icon',
          lon: 'lon',
          lat: 'lat',
          icon: 'pin',
          size: 22,
          dy: -9,
          title: '{' + V.ciudad + '}',
          alt: {
            if: V.favorita,
            then: t({
              es: 'Fue en {' + V.anio + '}; la repetiría',
              en: 'Visited in {' + V.anio + '}; would go back',
              pt: 'Foi em {' + V.anio + '}; voltaria',
            }),
            else: t({ es: 'Fue en {' + V.anio + '}', en: 'Visited in {' + V.anio + '}', pt: 'Foi em {' + V.anio + '}' }),
          },
          tooltip: [],
        },
        {
          mark: 'icon',
          lon: 'lon',
          lat: 'lat',
          filter: V.favorita,
          icon: 'star',
          color: 'ochre',
          size: 15,
          position: 'top-right',
          dy: -10,
          alt: t({ es: 'Favorita', en: 'Favorite', pt: 'Favorita' }),
          tooltip: false,
        },
        { mark: 'text', lon: 'lon', lat: 'lat', filter: V.favorita, text: '{' + V.ciudad + '}', position: 'right', dy: -9 },
      ],
    };

    // ------------------------------------------------------------ Un equipo de trabajo

    var E = t({
      es: { persona: 'persona', area: 'area', lidera: 'lidera', de: 'de', a: 'a' },
      en: { persona: 'person', area: 'team', lidera: 'lead', de: 'from', a: 'to' },
      pt: { persona: 'pessoa', area: 'area', lidera: 'lidera', de: 'de', a: 'para' },
    });
    var areas = t({
      es: ['Diseño', 'Código', 'Contenido', 'Clientes'],
      en: ['Design', 'Code', 'Content', 'Clients'],
      pt: ['Design', 'Código', 'Conteúdo', 'Clientes'],
    });
    var colores = {};
    colores[areas[0]] = 'pink';
    colores[areas[1]] = 'violet';
    colores[areas[2]] = 'teal';
    colores[areas[3]] = 'ochre';
    var gente = [
      ['Lucía', 0, true],
      ['Mateo', 0, false],
      ['Valeria', 0, false],
      ['Tomás', 1, true],
      ['Inés', 1, false],
      ['Raúl', 1, false],
      ['Julia', 2, true],
      ['Pablo', 2, false],
      ['Sara', 3, true],
      ['Diego', 3, false],
      ['Carmen', 3, false],
      ['Iván', 1, false],
    ];
    var personas = gente.map(function (g) {
      var fila = {};
      fila[E.persona] = g[0];
      fila[E.area] = areas[g[1]];
      fila[E.lidera] = g[2];
      return fila;
    });
    var parejas = [
      ['Lucía', 'Mateo'],
      ['Lucía', 'Valeria'],
      ['Mateo', 'Valeria'],
      ['Lucía', 'Tomás'],
      ['Tomás', 'Inés'],
      ['Tomás', 'Raúl'],
      ['Tomás', 'Iván'],
      ['Inés', 'Raúl'],
      ['Valeria', 'Inés'],
      ['Julia', 'Pablo'],
      ['Julia', 'Lucía'],
      ['Pablo', 'Mateo'],
      ['Sara', 'Diego'],
      ['Sara', 'Carmen'],
      ['Sara', 'Julia'],
      ['Sara', 'Tomás'],
      ['Diego', 'Carmen'],
      ['Carmen', 'Pablo'],
    ].map(function (p) {
      var fila = {};
      fila[E.de] = p[0];
      fila[E.a] = p[1];
      return fila;
    });
    var equipoSpec = {
      title: t({
        es: 'Quién trabaja con quién en el estudio',
        en: 'Who works with whom at the studio',
        pt: 'Quem trabalha com quem no estúdio',
      }),
      subtitle: t({
        es: 'Doce personas en cuatro áreas. La estrella marca a quien lidera cada una.',
        en: 'Twelve people on four teams. The star marks each team lead.',
        pt: 'Doze pessoas em quatro áreas. A estrela marca quem lidera cada uma.',
      }),
      locale: LOCALE[idioma],
      data: { personas: personas, juntos: parejas },
      network: { nodes: 'personas', id: E.persona, links: 'juntos', from: E.de, to: E.a },
      layers: [
        { mark: 'link', data: 'juntos' },
        {
          mark: 'icon',
          data: 'personas',
          icon: 'user',
          size: { if: E.lidera, then: 30, else: 24 },
          color: { field: E.area, map: colores },
          alt: {
            if: E.lidera,
            then: t({ es: '{' + E.area + '}, lidera', en: '{' + E.area + '}, lead', pt: '{' + E.area + '}, lidera' }),
            else: '{' + E.area + '}',
          },
          tooltip: [],
        },
        {
          mark: 'icon',
          data: 'personas',
          filter: E.lidera,
          icon: 'star',
          color: 'ochre',
          size: 13,
          position: 'top-right',
          alt: t({ es: 'Lidera su área', en: 'Team lead', pt: 'Lidera a área' }),
          tooltip: false,
        },
        { mark: 'text', data: 'personas', text: '{' + E.persona + '}', position: 'bottom', size: 12 },
      ],
    };

    // ------------------------------------------------------------ Frutas y el mínimo

    var F = t({
      es: { fruta: 'fruta', emoji: 'emoji', votos: 'votos' },
      en: { fruta: 'fruit', emoji: 'emoji', votos: 'votes' },
      pt: { fruta: 'fruta', emoji: 'emoji', votos: 'votos' },
    });
    var frutas = [
      [{ es: 'Mango', en: 'Mango', pt: 'Manga' }, '🥭', 61],
      [{ es: 'Aguacate', en: 'Avocado', pt: 'Abacate' }, '🥑', 55],
      [{ es: 'Banano', en: 'Banana', pt: 'Banana' }, '🍌', 42],
      [{ es: 'Fresa', en: 'Strawberry', pt: 'Morango' }, '🍓', 38],
      [{ es: 'Sandía', en: 'Watermelon', pt: 'Melancia' }, '🍉', 33],
      [{ es: 'Piña', en: 'Pineapple', pt: 'Abacaxi' }, '🍍', 27],
    ].map(function (f) {
      var fila = {};
      fila[F.fruta] = t(f[0]);
      fila[F.emoji] = f[1];
      fila[F.votos] = f[2];
      return fila;
    });
    var frutasSpec = {
      title: t({
        es: 'La fruta favorita de la oficina',
        en: 'The office’s favorite fruit',
        pt: 'A fruta favorita do escritório',
      }),
      subtitle: t({
        es: 'Votos de 256 personas en la encuesta del viernes. La ganadora va en rosa.',
        en: 'Votes from 256 people in Friday’s poll. The winner is in pink.',
        pt: 'Votos de 256 pessoas na enquete de sexta. A vencedora está em rosa.',
      }),
      locale: LOCALE[idioma],
      data: frutas,
      scales: { y: { title: t({ es: 'Votos', en: 'Votes', pt: 'Votos' }) } },
      layers: [
        { mark: 'bar', x: F.fruta, y: F.votos, color: { if: F.votos + ' >= 60', then: 'pink', else: 'violet' } },
        { mark: 'text', x: F.fruta, y: F.votos, text: '{' + F.votos + '}', position: 'top', weight: 'bold' },
        { mark: 'icon', x: F.fruta, y: F.votos, icon: { field: F.emoji }, size: 30, position: 'top', dy: -22, tooltip: false },
      ],
    };

    var M = t({
      es: { mes: 'mes', ventas: 'ventas' },
      en: { mes: 'month', ventas: 'sales' },
      pt: { mes: 'mes', ventas: 'vendas' },
    });
    var ventas = [42, 47, 45, 53, 58, 55, 61, 66, 63, 71, 74, 68].map(function (v, i) {
      var fila = {};
      fila[M.mes] = '2026-' + String(i + 1).padStart(2, '0');
      fila[M.ventas] = v;
      return fila;
    });
    var inicioSpec = {
      title: t({ es: 'Mi primer gráfico por capas', en: 'My first layered chart', pt: 'Meu primeiro gráfico em camadas' }),
      subtitle: t({
        es: 'Ventas por mes, en miles. Cambia un número y mira cómo se mueve.',
        en: 'Sales per month, in thousands. Change a number and watch it move.',
        pt: 'Vendas por mês, em milhares. Mude um número e veja o que acontece.',
      }),
      locale: LOCALE[idioma],
      data: ventas,
      layers: [
        { mark: 'rule', y: 60, label: t({ es: 'Meta: 60 mil', en: 'Goal: 60k', pt: 'Meta: 60 mil' }) },
        { mark: 'line', x: M.mes, y: M.ventas, curve: 'smooth', points: true },
        {
          mark: 'icon',
          x: M.mes,
          y: M.ventas,
          filter: M.ventas + ' >= 70',
          icon: 'star',
          color: 'ochre',
          size: 20,
          position: 'top',
          alt: t({ es: 'Pasó de 70 mil', en: 'Over 70k', pt: 'Passou de 70 mil' }),
        },
      ],
    };

    return [
      {
        id: 'habitos',
        nombre: t({ es: 'Hábitos del mes', en: 'Monthly habits', pt: 'Hábitos do mês' }),
        resumen: t({
          es: 'Un cuadro por día, un ✓ si lo cumpliste y la racha al final',
          en: 'A square per day, a ✓ when you kept it, and your streak',
          pt: 'Um quadrado por dia, um ✓ quando cumpriu e a sequência',
        }),
        spec: habitosSpec,
      },
      {
        id: 'notas',
        nombre: t({ es: 'Notas del curso', en: 'Class grades', pt: 'Notas da turma' }),
        resumen: t({
          es: 'Semáforo por materia, una carita si aprueba y su tendencia',
          en: 'A traffic light per subject, a face for passing, and a trend',
          pt: 'Semáforo por matéria, uma carinha se passa e a tendência',
        }),
        spec: notasSpec,
      },
      {
        id: 'clima',
        nombre: t({ es: 'El clima de la semana', en: 'This week’s weather', pt: 'O clima da semana' }),
        resumen: t({
          es: 'Sol, nubes y lluvia en seis ciudades, con su máxima',
          en: 'Sun, clouds, and rain in six cities, with the high',
          pt: 'Sol, nuvens e chuva em seis cidades, com a máxima',
        }),
        spec: climaSpec,
      },
      {
        id: 'viajes',
        nombre: t({ es: 'Mis viajes', en: 'My trips', pt: 'Minhas viagens' }),
        resumen: t({
          es: 'Un pin por ciudad y una estrella en las favoritas',
          en: 'A pin per city and a star on the favorites',
          pt: 'Um alfinete por cidade e uma estrela nas favoritas',
        }),
        spec: viajesSpec,
      },
      {
        id: 'equipo',
        nombre: t({ es: 'Un equipo', en: 'A team', pt: 'Uma equipe' }),
        resumen: t({
          es: 'Quién trabaja con quién, con el color de cada área',
          en: 'Who works with whom, colored by team',
          pt: 'Quem trabalha com quem, com a cor de cada área',
        }),
        spec: equipoSpec,
      },
      {
        id: 'frutas',
        nombre: t({ es: 'Fruta favorita', en: 'Favorite fruit', pt: 'Fruta favorita' }),
        resumen: t({
          es: 'Barras con un emoji encima de cada una',
          en: 'Bars with an emoji on top of each one',
          pt: 'Barras com um emoji em cima de cada uma',
        }),
        spec: frutasSpec,
      },
      {
        id: 'inicio',
        nombre: t({ es: 'Empieza aquí', en: 'Start here', pt: 'Comece aqui' }),
        resumen: t({
          es: 'Una línea, una meta y una estrella: lo mínimo',
          en: 'A line, a goal, and a star: the bare minimum',
          pt: 'Uma linha, uma meta e uma estrela: o mínimo',
        }),
        spec: inicioSpec,
      },
    ];
  }

  raiz.capasEjemplos = crear;
})(typeof window !== 'undefined' ? window : globalThis);
