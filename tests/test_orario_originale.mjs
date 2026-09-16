import fs from 'fs';
import path from 'path';

console.log('--- Test Struttura File Orario Originale EDT ---');
const dir = 'public/orario-originale';
const files = [
  'index.html',
  '_style.css',
  '_impression.css',
  '_affichage.js',
  '_bandeau.js',
  '_genre.js',
  '_ressource.js',
  '_periode.js',
  '_grille.js',
  '_signature.js',
  'classi/edc0000119p00001s3fffffffffffffff_4_binf_ac.png'
];

for (const f of files) {
  const p = path.join(dir, f);
  if (!fs.existsSync(p)) {
    throw new Error('File mancante: ' + p);
  }
  const size = fs.statSync(p).size;
  console.log(`  ✓ ${f} (${size} bytes)`);
}

console.log('\n--- Test Risoluzione Codice 4BINF ---');
const resContent = fs.readFileSync(path.join(dir, '_ressource.js'), 'utf-8');
const affContent = fs.readFileSync(path.join(dir, '_affichage.js'), 'utf-8');

const sandbox = {
  titrePage: 'ORARIO',
  dateDerniereMaj: '12/09/2026',
  libChoixGenre: 'Ricerca per:',
  listeGenres: [],
  GenreRessource: function(g, l) { this.genre = g; this.libelle = l; },
  listeChoixRessources: {},
  listeRessources: [],
  Ressource: function(g, l, c) { this.genre = g; this.libelle = l; this.codage = c; },
  document: {
    getElementById: () => ({ innerHTML: '' }),
    querySelector: () => ({ value: '', options: [] })
  },
  window: {
    location: { search: '?classe=4BINF' }
  },
  URLSearchParams: URLSearchParams
};

const fn = new Function('with(this) { ' + resContent + '\n' + affContent + '\nreturn { trovaCodiceClasse, listeRessources }; }');
const { trovaCodiceClasse, listeRessources } = fn.call(sandbox);

console.log(`  Totale risorse caricate: ${listeRessources.length}`);

// Test varianti nome 4BINF
const testCases = ['4BINF', '4 BINF', '4-BINF', '4 binf', '4 B-INFO'];
for (const tc of testCases) {
  const code = trovaCodiceClasse(tc);
  console.log(`  trovaCodiceClasse("${tc}") -> ${code}`);
  if (code !== 'c0000119') {
    throw new Error(`Errore: atteso c0000119 per "${tc}", ottenuto ${code}`);
  }
}

console.log('✓ Tutti i test per l\'orario originale e la selezione di 4BINF sono passati con successo!');
