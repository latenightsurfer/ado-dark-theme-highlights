# ado-dark-theme-highlights

Tampermonkey userscript that restores highlight and font colors in Azure DevOps when the dark
theme is on.

In the Azure DevOps dark theme, text highlights and font colors in comments and descriptions
disappear: the theme overrides the colors the author picked. Teams often use these colors as
categories (for example cyan for a question, green for an answer, orange for an action), so the
meaning gets lost as well. This script brings the colors back and keeps the text readable.

## What it does

- Shows every highlight as a dark tint with the same hue, so different colors stay
  distinguishable on the dark background. Works for any color, not only a fixed list.
- Draws a thin underline in the author's exact color (can be turned off).
- Shows the original color as a tooltip when you hover a highlight.
- Restores font colors and lightens those that would be too dark to read.
- Only changes colors the dark theme has overridden; the light theme stays as it is.
- Also handles comments that load later (Azure DevOps is a single-page app).

## Installation

1. Install the browser extension [Tampermonkey](https://www.tampermonkey.net/)
   (Firefox, Chrome, Edge).
2. Open the [script file](https://raw.githubusercontent.com/latenightsurfer/ado-dark-theme-highlights/main/ado-dark-theme-highlights.user.js)
   and click **Install** on the Tampermonkey page that opens.
3. Using Azure DevOps Server (on-premises)? Add your server's address as a user match, see
   [Supported hosts](#supported-hosts). Without it the script does nothing there.
4. Reload Azure DevOps.

Tampermonkey checks for new versions regularly and updates the script by itself.

## Supported hosts

Out of the box the script runs on Azure DevOps Services: `dev.azure.com` and
`*.visualstudio.com`.

**Azure DevOps Server (on-premises) must be added by you**, otherwise the script does nothing
there. In Tampermonkey: **Dashboard → the script → Settings → Includes/Excludes → User matches →
Add…**, for example `https://devops.example.com/*`. Add one entry per address you use, including
the `http://` variant if your server is reachable that way. User matches survive updates; don't
add `@match` lines to the script itself, an update would remove them.

## Configuration

Don't edit the script itself: automatic updates would overwrite your changes. Use the script's
Tampermonkey storage instead:

1. Tampermonkey **Dashboard → Settings → Config mode: Advanced**.
2. Open the script → tab **Storage**. After the first run it contains `"config": {}`.
3. Add only the options you want to change, save, and reload Azure DevOps:

```json
{
  "config": {
    "highlightMode": "dimmed",
    "originalColorUnderline": false
  }
}
```

| Option | Default | Effect |
|---|---|---|
| `highlightMode` | `"tinted"` | `"tinted"`: dark tint with the same hue. `"dimmed"`: original color blended into the dark background. `"original"`: exactly the picked color (bright). |
| `tintLightness` | `0.3` | `"tinted"`: brightness of the tint, 0–1. |
| `tintSaturation` | `0.6` | `"tinted"`: maximum color strength of the tint, 0–1. |
| `dimStrength` | `0.55` | `"dimmed"`: share of the original color kept, 0–1. |
| `originalColorUnderline` | `true` | Underline in the original color under tinted or dimmed highlights. |
| `highlightMap` | `{}` | Fixed replacement per color, wins over `highlightMode`, e.g. `{ "#80ffff": "#1f5f6b" }`. |
| `textOnLightHighlight` | `"#000000"` | Text color on light highlights. |
| `textOnDarkHighlight` | `"#ffffff"` | Text color on dark highlights. |
| `tooDarkFontColor` | `"lighten"` | Font colors too dark for the background: `"lighten"` keeps the hue and lightens it, `"theme"` uses the normal text color. |
| `minTextContrast` | `3` | Minimum contrast ratio for font colors (`4.5` is stricter). |
| `debug` | `false` | Logs every corrected element to the browser console. |

## Troubleshooting

Run this in the browser console (F12) on a page with highlights:

```js
document.querySelectorAll('[data-ado-color-fix="fixed"]').length
```

A number greater than 0 means the script corrected colors. If it is 0, the highlight may not be
stored as an inline color; please open an issue with the HTML of the highlighted text
(right-click → Inspect).
