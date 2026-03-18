# Recap Della Logica Dei Recommended

Ecco il recap, spiegato da beginner.

La logica dei `recommended` non è: "prendo i titoli con score più alto e li compro". È un processo a 2 livelli:

1. prima il sistema trova i titoli tecnicamente interessanti
2. poi controlla se il trade è davvero tradabile secondo regole di rischio molto rigide

Quindi un titolo può essere forte, ben rankato, ma comunque `NOT_RECOMMENDED`.

## Come nasce la shortlist

Il motore parte da un universo di titoli e scarta quelli che non rispettano filtri base: prezzo nel range, volatilità non eccessiva, trend accettabile, valuta supportata.

Nella strategia di default i filtri sono abbastanza larghi: prezzo 5-500, ATR% massimo 15%, trend richiesto, valute USD/EUR.

## Come vengono ordinati

Dopo il filtro, ogni titolo riceve uno `score` basato su:

- momentum a 6 mesi
- momentum a 12 mesi
- forza relativa a 6 mesi contro il benchmark

In pratica: il sistema premia i titoli che stanno già andando meglio degli altri. Questa è la parte "momentum".

## Quando un titolo diventa interessante operativamente

Poi il sistema cerca un segnale di ingresso:

- `breakout`: il prezzo rompe i massimi recenti
- `pullback`: il prezzo recupera una media mobile dopo un ritracciamento
- `both`: entrambe le cose, quindi setup più forte

Se non c'è segnale attivo, il titolo può essere buono come idea, ma non diventa `recommended`.

## Come decide `RECOMMENDED`

Qui entra la parte più importante. Il verdetto finale viene da una checklist: il trade è `RECOMMENDED` solo se passa tutto.

I controlli principali sono:

- c'è un segnale attivo
- esiste uno stop valido sotto l'entry
- la size è tradabile
- il rischio sta dentro il budget
- il reward/risk è almeno il minimo richiesto
- costi e slippage non mangiano troppo il trade

Se anche solo uno di questi fallisce, il verdetto diventa `NOT_RECOMMENDED`.

## Tradotto in linguaggio semplice

Un `recommended` significa:

"Non è solo un titolo forte. È un titolo forte, con setup attivo, con stop chiaro, con rischio controllato, e con un rapporto rendimento/rischio abbastanza buono da meritare l'operazione."

## Le soglie di default più importanti

Nella strategia default:

- rischio per trade: 1% del capitale
- stop: circa `entry - 2 x ATR`
- reward/risk minimo: 2.0
- fees massime: 20% del rischio pianificato

Questo vuol dire che il sistema preferisce trade con payoff asimmetrico: rischio 1 per puntare almeno a 2.

## Differenza fra `score`, `confidence` e `recommended`

- `score`: quanto il titolo è forte rispetto agli altri
- `confidence`: quanto il setup sembra qualitativamente solido
- `recommended`: sì/no finale, dopo i controlli di rischio

Questa distinzione è importante: un titolo può avere score alto ma non essere raccomandato.

## Nella Daily Review

La Daily Review mostra solo i candidati con verdict `RECOMMENDED` e nasconde gli altri.

Se vuoi, questo documento può diventare anche la base per una mini sezione educativa in UI, con esempi tipo "perché questo titolo non è recommended".
