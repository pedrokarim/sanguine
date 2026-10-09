"""Prépare les polices du jeu et les écrit dans `src/ui/fonts.css`.

Le dépôt n'embarque aucun fichier binaire : les polices sont donc réduites aux seuls
caractères utiles, compressées en WOFF2, puis inscrites dans une feuille de styles sous forme
de données (`data:`). Aucune requête réseau, aucun fichier à servir.

Sources, toutes sous licence SIL Open Font License 1.1 (textes dans `licenses/`) :
  - Jacquard 24   https://github.com/google/fonts/tree/main/ofl/jacquard24
  - Pixelify Sans https://github.com/google/fonts/tree/main/ofl/pixelifysans
  - Jersey 10     https://github.com/google/fonts/tree/main/ofl/jersey10

Jersey 10 ne fournit que les chiffres. Ceux de Pixelify Sans prêtent à confusion – son « 5 »
se lit « S », si bien que « +0.5 projectile » devenait « +0.S » – et dans un jeu où l'on
compare des pourcentages toute la partie, un chiffre ambigu est une faute. Les deux polices
sont déclarées sous le même nom de famille, chacune limitée à sa plage de caractères : le
navigateur prend les lettres dans l'une et les chiffres dans l'autre, sans rien changer
ailleurs.

Usage :
    python tools/build-fonts.py <Jacquard24-Regular.ttf> <PixelifySans[wght].ttf> <Jersey10-Regular.ttf>

Dépendances : fonttools, brotli.
"""
import base64
import io
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

# Latin de base, Latin-1 (accents français), œ Œ Ÿ, tirets, guillemets, apostrophe courbe,
# points de suspension, signe moins et multiplication.
UNICODES = (
    list(range(0x20, 0x7F)) + list(range(0xA0, 0x100))
    + [0x152, 0x153, 0x178, 0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026, 0x2212]
)

OUT = Path(__file__).resolve().parent.parent / "src" / "ui" / "fonts.css"


def even_digits(font):
    """Donne à tous les chiffres la même chasse.

    Le « 1 » est plus étroit que les autres chiffres : un compteur qui passe de 10 à 20
    change de largeur et fait sautiller tout ce qui le suit. Faute de variante tabulaire
    dans la police, on élargit les chiffres étroits et on les recentre.
    """
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    glyf = font["glyf"]
    widest = max(hmtx[cmap[ord(d)]][0] for d in "0123456789")
    for d in "0123456789":
        name = cmap[ord(d)]
        advance, lsb = hmtx[name]
        if advance == widest:
            continue
        shift = (widest - advance) // 2
        glyph = glyf[name]
        glyph.coordinates.translate((shift, 0))
        glyph.recalcBounds(glyf)
        hmtx[name] = (widest, lsb + shift)


DIGITS = list(range(0x30, 0x3A))


def pack(path, fix_digits, unicodes=None):
    font = TTFont(path)
    if fix_digits:
        even_digits(font)
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.notdef_outline = True
    sub = subset.Subsetter(options)
    sub.populate(unicodes=unicodes or UNICODES)
    sub.subset(font)
    buffer = io.BytesIO()
    font.flavor = "woff2"
    font.save(buffer)
    return buffer.getvalue()


def face(family, data, weight, extra=""):
    b64 = base64.b64encode(data).decode("ascii")
    return (
        "@font-face {\n"
        f'  font-family: "{family}";\n'
        f"  font-weight: {weight};\n"
        "  font-style: normal;\n"
        "  font-display: block;\n"
        + extra +
        f'  src: url("data:font/woff2;base64,{b64}") format("woff2");\n'
        "}\n"
    )


def main():
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    display = pack(sys.argv[1], fix_digits=False)
    ui = pack(sys.argv[2], fix_digits=False, unicodes=[u for u in UNICODES if u not in DIGITS])
    digits = pack(sys.argv[3], fix_digits=True, unicodes=DIGITS)
    css = (
        "/* Généré par tools/build-fonts.py – ne pas modifier à la main.\n"
        " * Jacquard 24, Pixelify Sans et Jersey 10, SIL Open Font License 1.1 : voir licenses/. */\n\n"
        + face("Jacquard 24", display, "400")
        + "\n"
        + face("Pixelify Sans", ui, "400", "  unicode-range: U+0020-002F, U+003A-017F, U+2010-2027, U+2212;\n")
        + "\n"
        # Les chiffres de Jersey 10 sont dessinés plus petit : `size-adjust` les remet à l'œil
        # de Pixelify Sans, sans quoi un nombre paraîtrait rétréci au milieu d'une phrase.
        + face("Pixelify Sans", digits, "400", "  unicode-range: U+0030-0039;\n  size-adjust: 126%;\n")
    )
    OUT.write_text(css, encoding="utf-8")
    print(f"{OUT.name}: Jacquard 24 {len(display)} o, Pixelify Sans {len(ui)} o, Jersey 10 (chiffres) {len(digits)} o")


if __name__ == "__main__":
    main()
