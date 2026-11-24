const fs = require("fs");
const path = require("path");

const root = "/Users/jvasquez/Desktop/aplicaciones_en_red";
function teamLogoUrl(abbreviation) {
  const logoIds = {
    ATL: "atl", BKN: "bkn", BOS: "bos", CHA: "cha", CHI: "chi", CLE: "cle",
    DAL: "dal", DEN: "den", DET: "det", GS: "gs", HOU: "hou", IND: "ind",
    LAC: "lac", LAL: "lal", MEM: "mem", MIA: "mia", MIL: "mil", MIN: "min",
    NO: "no", NY: "ny", OKC: "okc", ORL: "orl", PHI: "phi", PHX: "phx",
    POR: "por", SAC: "sac", SA: "sa", TOR: "tor", UTAH: "utah", WSH: "wsh"
  };
  const logoId = logoIds[abbreviation.toUpperCase()] || abbreviation.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/nba/500/${logoId}.png`;
}

function slug(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function storyLead(game) {
  const margin = game.winner.score - game.loser.score;
  const index = Number(game.id.slice(-1));
  if (margin <= 3) {
    const endings = [
      `El partido quedó abierto hasta el cierre y ${game.winner.name} encontró la jugada decisiva para ganar por ${margin}.`,
      `Nada quedó resuelto hasta los últimos instantes: ${game.winner.name} sostuvo la ventaja suficiente y cerró el duelo por ${margin} puntos.`,
      `Un final ajustado convirtió cada posesión en un episodio decisivo. ${game.winner.name} se llevó el triunfo por ${margin}.`
    ];
    return endings[index % endings.length];
  }
  if (margin >= 20) {
    const endings = [
      `${game.winner.name} no dejó lugar a la duda: construyó una ventaja amplia y firmó una victoria rotunda por ${margin} puntos.`,
      `La diferencia fue creciendo con el paso del partido y ${game.winner.name} terminó imponiendo su ritmo ante ${game.loser.name}.`,
      `${game.winner.name} logró separar al marcador pronto y convirtió el encuentro en una exhibición de control por ${margin} puntos.`
    ];
    return endings[index % endings.length];
  }
  const endings = [
    `${game.winner.name} fue construyendo su victoria ante ${game.loser.name} y sostuvo el resultado hasta el marcador final.`,
    `El encuentro tuvo respuestas de ambos lados, pero ${game.winner.name} apareció con la ventaja decisiva al cierre.`,
    `Ninguno de los dos equipos concedió el partido con facilidad; ${game.winner.name} encontró la distancia necesaria para ganar.`
  ];
  return endings[index % endings.length];
}

async function main() {
  const games = [];
  for (let day = 14; day <= 23; day++) {
    const date = `202611${String(day).padStart(2, "0")}`;
    const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${date}`);
    const data = await response.json();

    for (const event of data.events || []) {
      const competition = event.competitions?.[0];
      const competitors = (competition?.competitors || []).map((competitor) => ({
        abbr: competitor.team?.abbreviation || "",
        name: competitor.team?.displayName || competitor.team?.name || "",
        score: Number(competitor.score || 0),
        winner: Boolean(competitor.winner)
      }));

      if (competitors.length !== 2) continue;
      const winner = competitors.find((team) => team.winner) || (competitors[0].score >= competitors[1].score ? competitors[0] : competitors[1]);
      const loser = competitors.find((team) => team !== winner);

      games.push({
        id: event.id,
        date: day,
        name: event.name,
        winner,
        loser,
        competitors
      });
    }
  }

  games.sort((a, b) => b.date - a.date || a.id.localeCompare(b.id));

  const teamMap = new Map();
  for (const game of games) {
    for (const team of game.competitors) {
      teamMap.set(team.abbr, team.name);
    }
  }

  let index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const cards = games.map((game, indexNumber) => {
    const teams = `${game.winner.abbr.toLowerCase()} ${game.loser.abbr.toLowerCase()}`;
    const dataTeams = game.competitors.map((team) => slug(team.abbr)).join(" ");
    const title = `${game.winner.name} vence a ${game.loser.name}`;
    const winnerLogo = escapeHtml(teamLogoUrl(game.winner.abbr));
    const loserLogo = escapeHtml(teamLogoUrl(game.loser.abbr));

    return `\t\t\t\t<article class="post" id="${escapeHtml(game.id)}" data-equipos="${escapeHtml(dataTeams)}">
\t\t\t\t\t<a class="post-team-matchup" href="${escapeHtml(game.id)}.html" tabindex="-1" aria-hidden="true">
\t\t\t\t\t\t<img src="${winnerLogo}" alt="${escapeHtml(game.winner.name)}" loading="lazy">
\t\t\t\t\t\t<span>vs</span>
\t\t\t\t\t\t<img src="${loserLogo}" alt="${escapeHtml(game.loser.name)}" loading="lazy">
\t\t\t\t\t</a>
\t\t\t\t\t<p class="meta">${game.date} de noviembre · ${escapeHtml(game.winner.abbr)} ${game.winner.score} <span>/</span> ${escapeHtml(game.loser.abbr)} ${game.loser.score}</p>
\t\t\t\t\t<h3><a href="${escapeHtml(game.id)}.html">${escapeHtml(title)}</a></h3>
\t\t\t\t\t<p>${escapeHtml(storyLead(game))}</p>
\t\t\t\t\t<a class="text-link" href="${escapeHtml(game.id)}.html">Leer historia <span aria-hidden="true">↗</span></a>
\t\t\t\t</article>`;
  }).join("\n");

  const options = [...teamMap.entries()].sort((a, b) => a[1].localeCompare(b[1], "es")).map(([abbr, name]) => {
    return `\t\t\t\t\t<option value="${escapeHtml(slug(abbr))}">${escapeHtml(name)}</option>`;
  }).join("\n");

  index = index.replace(/\t\t\t<div class="filter" id="filtro-equipos" hidden>[\s\S]*?<\/div>\n\t\t\t<div class="posts">/, `\t\t\t<div class="filter" id="filtro-equipos" hidden>
\t\t\t\t<label for="equipo">Equipo</label>
\t\t\t\t<select id="equipo">
\t\t\t\t\t<option value="">Todos los equipos</option>
${options}
\t\t\t\t</select>
\t\t\t\t<p class="filter-status" id="estado-filtro" role="status" aria-live="polite"></p>
\t\t\t</div>
\t\t\t<div class="posts">`);

  index = index.replace(/(<div class="posts">)[\s\S]*?(\n\t\t\t<\/div>\n\t\t<\/section>)/, `$1\n${cards}\n\t\t\t$2`);
  index = index.replace(/<p>La jornada del 21 de noviembre<\/p>/, `<p>Partidos del 14 al 23 de noviembre</p>`);
  index = index.replace(/<h1>La NBA, partido a partido\.<\/h1>/, `<h1>La NBA, partido a partido.</h1>`);
  fs.writeFileSync(path.join(root, "index.html"), index);

  for (const game of games) {
    const winner = game.winner;
    const loser = game.loser;
    const title = `${winner.name} vence a ${loser.name}`;
    const source = `https://www.espn.com/nba/game/_/gameId/${game.id}`;
    const winnerLogo = escapeHtml(teamLogoUrl(winner.abbr));
    const loserLogo = escapeHtml(teamLogoUrl(loser.abbr));

    const article = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeHtml(winner.name)} venció ${winner.score}-${loser.score} a ${escapeHtml(loser.name)} el ${game.date} de noviembre.">
  <title>${escapeHtml(title)} | Entre Canastas</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&amp;family=Playfair+Display:wght@400;500;600;700&amp;display=swap" rel="stylesheet">
  <link rel="stylesheet" href="articulos.css">
</head>
<body>
  <div class="topline"><div class="wrap">Baloncesto, partido a partido</div></div>
  <header class="wrap masthead">
    <a class="brand" href="index.html">entre canastas<span>.</span></a>
    <nav aria-label="Navegación principal"><a href="index.html">Inicio</a><a href="index.html#historias">Historias</a><a href="index.html#acerca">Acerca de</a></nav>
  </header>
  <main class="wrap">
    <article>
      <header class="article-header">
        <p class="meta">${escapeHtml(winner.abbr)} ${winner.score} / ${escapeHtml(loser.abbr)} ${loser.score} · ${game.date} de noviembre de 2026</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="lead">${escapeHtml(storyLead(game))}</p>
      </header>
      <div class="cover-team-matchup" aria-label="${escapeHtml(winner.name)} contra ${escapeHtml(loser.name)}">
        <img src="${winnerLogo}" alt="${escapeHtml(winner.name)}">
        <span>vs</span>
        <img src="${loserLogo}" alt="${escapeHtml(loser.name)}">
      </div>
      <div class="article-body">
        <p>${escapeHtml(storyLead(game))} El ${game.date} de noviembre de 2026 quedó una nueva referencia en la temporada: ${winner.score}-${loser.score}, a favor de ${winner.name}.</p>
        <h2>Cómo se decidió el partido</h2>
        <p>${loser.name} llegó al último tramo con oportunidades de cambiar el rumbo, pero ${winner.name} supo administrar la posesión y proteger el marcador. Cada canasta tuvo peso en una noche que terminó con ${winner.score - loser.score} puntos de diferencia.</p>
        <p>Más allá de la cifra final, el encuentro mostró las apuestas de ambos equipos: ${winner.name} intentó dar consistencia a su ventaja y ${loser.name} siguió buscando una respuesta hasta el cierre.</p>
        <p>Fuente: <a href="${source}">estadísticas y fichaje del partido en ESPN</a>.</p>
      </div>
    </article>
    <div class="article-end"><a href="index.html#historias">← Todas las historias</a><a href="index.html#historias">Volver al listado →</a></div>
  </main>
  <footer><div class="wrap"><p>© Entre Canastas. Baloncesto, partido a partido.</p></div></footer>
</body>
</html>
`;

    fs.writeFileSync(path.join(root, `${game.id}.html`), article);
  }

  const oldPages = ["lugares.html","ideas.html","cotidiano.html","mavericks-clippers.html","timberwolves-grizzlies.html","kings-celtics.html","harden-cavaliers.html","nuggets-bulls.html","warriors-celtics.html"];
  for (const oldPage of oldPages) {
    const oldPath = path.join(root, oldPage);
    if (fs.existsSync(oldPath)) fs.rmSync(oldPath);
  }

  console.log(`Generated ${games.length} games and pages`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
