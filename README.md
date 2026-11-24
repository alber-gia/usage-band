# usage-band

Mod per Claude Code: una barra sopra il prompt che mostra, durante la sessione:

- token consumati (input, output, cache);
- % di utilizzo dei limiti a 5 ore e 7 giorni, con l'ora di ripristino (fuso Europe/Rome);
- % della finestra di contesto occupata;
- costo stimato in euro a tariffe API (stima di `/cost` convertita con un cambio fisso, non è una fattura);
- numero di turni della chat;
- skill usate, con il numero di invocazioni.

Limiti e contesto hanno colori semaforo: verde sotto il 60%, giallo dal 60% all'85%, rosso oltre l'85%.

## Installazione

Dal prompt di Claude Code:

```
/plugin install usage-band --marketplace alber-gia/usage-band
```

Da shell:

```
claude plugin install usage-band --marketplace alber-gia/usage-band
```

## Configurazione

In cima a `hooks/register.tsx`: `EUR_PER_USD` (cambio, default 0,87), `GIALLO` e `ROSSO` (soglie in %).

## Limiti noti

- Le percentuali dei limiti compaiono solo dopo la prima risposta e solo su account in abbonamento.
- Token, turni e skill si contano da quando il mod è attivo; contesto e costo sono totali della sessione.
