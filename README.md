# Mozgó magyarázatok

Öt tantárgy, öt téma – lépésről lépésre animált, interaktív leckék az oktatáshoz.

**Megnyitás:** https://megzo.github.io/mozgo-magyarazatok/

| Tantárgy | Lecke |
|---|---|
| Történelem | [A magyarok vándorlása az őshazától a Kárpát-medencéig](https://megzo.github.io/mozgo-magyarazatok/tortenelem-vandorlas.html) |
| Kémia | [A maghasadás működése](https://megzo.github.io/mozgo-magyarazatok/kemia-maghasadas.html) |
| Fizika | [A kompresszoros hűtés elve](https://megzo.github.io/mozgo-magyarazatok/fizika-hutes.html) |
| Matematika | [A kör területe és a π](https://megzo.github.io/mozgo-magyarazatok/matek-kor-pi.html) |
| Informatika | [Kézzel írt számjegyek felismerése neurális hálóval (MNIST)](https://megzo.github.io/mozgo-magyarazatok/informatika-mnist.html) |

Léptetés: <kbd>←</kbd> <kbd>→</kbd> · <kbd>R</kbd> újrajátszás · <kbd>F</kbd> teljes képernyő.
Teljesen statikus és offline is működik: letöltés után az `index.html` dupla kattintással megnyitható.

A leckék fekvő képernyőre és kivetítőre készültek (16:9); telefonon fektetve nézhetők.

A leckék [Claude](https://claude.ai) segítségével készültek. Szakmai átnézésük folyamatban
van – ha hibát találsz, vagy van témád, amit így látnál szívesen, nyiss egy
[issue-t](https://github.com/Megzo/mozgo-magyarazatok/issues).

## Licenc

- **Programkód** (`shared/*.js`, `shared/*.css`, a HTML-fájlokban lévő kód): [MIT](LICENSE)
- **Tartalom** (szövegek, ábrák, az animációk megjelenése): [CC BY 4.0](LICENSE-CONTENT.md) –
  szabadon felhasználható, átdolgozható, a szerző megnevezésével.

Külső források, saját licencük szerint:

- Térképadatok: [Natural Earth](https://www.naturalearthdata.com/) – közkincs (public domain)
  (`data/tortenelem-map.js`)
- Kézírásos számjegyek: MNIST adatbázis (Yann LeCun, Corinna Cortes, Christopher J. C. Burges) –
  CC BY-SA 3.0. A `data/informatika-mnist.js` 200 mintát és az ezen tanított háló súlyait
  tartalmazza; erre a fájlra a CC BY-SA 3.0 vonatkozik.
- Betűtípusok: Fraunces, Bricolage Grotesque, JetBrains Mono – SIL Open Font License 1.1
  (`shared/fonts/OFL-*.txt`)
