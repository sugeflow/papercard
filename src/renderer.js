// Canvas renderer for share cards. Shared by the content script (real posts)
// and the options page (live preview). Expects already-hydrated image URLs
// (data: or same-origin) so the canvas never gets tainted.
(function initRenderer(root) {
  const core = root.TwitterShareImageCore || {};

  const CANVAS_WIDTH = 720;
  // Always export at 2x so cards stay sharp on phones and retina screens,
  // regardless of the display the card was created on.
  const EXPORT_SCALE = 2;
  const QR_CODE_SIZE = 76;
  const MEDIA_GAP = 14;
  // Very tall images (long screenshots, comics) are cropped from the top so a
  // single picture can't turn the card into a scroll.
  const MAX_MEDIA_RATIO = 1.6;
  const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
  const SERIF = 'Georgia, "Times New Roman", "Songti SC", "STSong", "Noto Serif CJK SC", serif';

  // Each template decides layout and type; `theme` (light/dark) picks its palette.
  const TEMPLATES = {
    paper: {
      frame: 0,
      pad: 42,
      radius: 0,
      avatarSize: 52,
      header: "top",
      title: { font: `700 32px ${SERIF}`, lineHeight: 44 },
      body: { font: `30px ${SERIF}`, lineHeight: 44 },
      palettes: {
        light: {
          background: "#fbfaf7",
          border: "#e7e0d5",
          name: "#111827",
          handle: "#667085",
          text: "#1f2933",
          footer: "#7a6f63",
          line: "#e7e0d5",
          avatar: "#263238",
          avatarText: "#ffffff"
        },
        dark: {
          background: "#171716",
          border: "#3c3933",
          name: "#f2eadc",
          handle: "#a79f91",
          text: "#eee4d2",
          footer: "#b8ad9b",
          line: "#3c3933",
          avatar: "#4b4238",
          avatarText: "#fff8ec"
        }
      }
    },
    minimal: {
      frame: 0,
      pad: 56,
      radius: 0,
      avatarSize: 48,
      header: "top",
      title: { font: `700 30px ${SANS}`, lineHeight: 42 },
      body: { font: `27px ${SANS}`, lineHeight: 42 },
      palettes: {
        light: {
          background: "#ffffff",
          name: "#0f1419",
          handle: "#536471",
          text: "#0f1419",
          footer: "#536471",
          line: "#eff3f4",
          avatar: "#0f1419",
          avatarText: "#ffffff"
        },
        dark: {
          background: "#000000",
          name: "#e7e9ea",
          handle: "#71767b",
          text: "#e7e9ea",
          footer: "#71767b",
          line: "#2f3336",
          avatar: "#e7e9ea",
          avatarText: "#000000"
        }
      }
    },
    magazine: {
      frame: 0,
      pad: 56,
      radius: 0,
      avatarSize: 44,
      header: "bottom",
      accentBar: 10,
      quoteMark: true,
      title: { font: `700 34px ${SERIF}`, lineHeight: 46 },
      body: { font: `italic 30px ${SERIF}`, lineHeight: 46 },
      palettes: {
        light: {
          background: "#f3ede2",
          name: "#231f1a",
          handle: "#8a7f70",
          text: "#231f1a",
          footer: "#8a7f70",
          line: "#ddd2c0",
          avatar: "#b4441f",
          avatarText: "#fff8ec",
          accent: "#b4441f"
        },
        dark: {
          background: "#1e1b18",
          name: "#efe6d6",
          handle: "#a39684",
          text: "#efe6d6",
          footer: "#a39684",
          line: "#3a342d",
          avatar: "#e0794f",
          avatarText: "#1e1b18",
          accent: "#e0794f"
        }
      }
    },
    gradient: {
      frame: 44,
      pad: 38,
      radius: 22,
      avatarSize: 48,
      header: "top",
      title: { font: `700 29px ${SANS}`, lineHeight: 40 },
      body: { font: `26px ${SANS}`, lineHeight: 40 },
      palettes: {
        light: {
          frame: ["#ffd3a5", "#fd6585"],
          background: "#ffffff",
          name: "#0f1419",
          handle: "#536471",
          text: "#0f1419",
          footer: "#536471",
          line: "#eff3f4",
          avatar: "#fd6585",
          avatarText: "#ffffff"
        },
        dark: {
          frame: ["#3a1c71", "#1e3c72"],
          background: "#15202b",
          name: "#f7f9f9",
          handle: "#8b98a5",
          text: "#f7f9f9",
          footer: "#8b98a5",
          line: "#38444d",
          avatar: "#7b5cff",
          avatarText: "#ffffff"
        }
      }
    }
  };
  const QR_COLORS = {
    light: { qrBackground: "#ffffff", qrForeground: "#1f2933", qrBorder: "rgba(0, 0, 0, 0.12)" },
    dark: { qrBackground: "#f5eedf", qrForeground: "#171716", qrBorder: "rgba(255, 255, 255, 0.2)" }
  };
  // Monochrome platform glyphs (24×24 paths) from Simple Icons, CC0:
  // https://simpleicons.org. Trademarks belong to their owners; the glyph only
  // marks where a post came from. `box` is the measured ink bounds [x, y, w, h]
  // so every mark is centred and sized by what is actually drawn. Solid-square
  // marks get `optical` < 1 so they don't look heavier than line glyphs, and
  // Xiaohongshu's wordmark (≈3:1) is knocked out of a rounded-square `badge`,
  // like its app icon, because on its own it's unreadable at this size.
  const PLATFORM_ICONS = {
    x: { box: [0.25, 0, 23.5, 24], d: "M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" },
    reddit: { box: [0, 0, 24, 24], d: "M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z" },
    threads: { box: [1.15, 0, 21.68, 24], d: "M18.263 11.097c-.03-3.486-1.92-5.586-5.111-5.586-2.13 0-3.922.963-4.863 2.499l2.062 1.438c.535-.843 1.272-1.543 2.628-1.543 1.528 0 2.318.85 2.544 2.431a15 15 0 0 0-2.236-.173c-4.125 0-6.068 1.867-6.068 4.336s1.943 3.99 4.804 3.99c3.139 0 5.013-2.115 5.781-4.735.798.361 1.348 1.204 1.348 2.47 0 3.387-3.907 5.232-7.22 5.232-4.885 0-8.077-3.207-8.077-8.424 0-6.392 4.223-10.487 9.9-10.487 3.808 0 5.69 1.671 6.97 3.914l2.108-1.475C21.44 2.078 18.331 0 13.663 0 6.227 0 1.168 5.277 1.168 12.934c0 7 4.953 11.066 10.856 11.066 4.878 0 9.809-2.846 9.809-7.716 0-2.545-1.46-4.231-3.569-5.187m-6.33 4.855c-1.077 0-2.026-.512-2.026-1.453 0-1.483 1.822-1.934 3.606-1.934.678 0 1.34.045 1.927.173-.422 1.927-1.671 3.215-3.508 3.214Z" },
    instagram: { box: [0, 0, 24, 24], d: "M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077" },
    bluesky: { box: [0, 1.43, 24, 21.15], d: "M5.202 2.857C7.954 4.922 10.913 9.11 12 11.358c1.087-2.247 4.046-6.436 6.798-8.501C20.783 1.366 24 .213 24 3.883c0 .732-.42 6.156-.667 7.037-.856 3.061-3.978 3.842-6.755 3.37 4.854.826 6.089 3.562 3.422 6.299-5.065 5.196-7.28-1.304-7.847-2.97-.104-.305-.152-.448-.153-.327 0-.121-.05.022-.153.327-.568 1.666-2.782 8.166-7.847 2.97-2.667-2.737-1.432-5.473 3.422-6.3-2.777.473-5.899-.308-6.755-3.369C.42 10.04 0 4.615 0 3.883c0-3.67 3.217-2.517 5.202-1.026" },
    weibo: { box: [0, 2.25, 24, 19.5], d: "M10.098 20.323c-3.977.391-7.414-1.406-7.672-4.02-.259-2.609 2.759-5.047 6.74-5.441 3.979-.394 7.413 1.404 7.671 4.018.259 2.6-2.759 5.049-6.737 5.439l-.002.004zM9.05 17.219c-.384.616-1.208.884-1.829.602-.612-.279-.793-.991-.406-1.593.379-.595 1.176-.861 1.793-.601.622.263.82.972.442 1.592zm1.27-1.627c-.141.237-.449.353-.689.253-.236-.09-.313-.361-.177-.586.138-.227.436-.346.672-.24.239.09.315.36.18.601l.014-.028zm.176-2.719c-1.893-.493-4.033.45-4.857 2.118-.836 1.704-.026 3.591 1.886 4.21 1.983.64 4.318-.341 5.132-2.179.8-1.793-.201-3.642-2.161-4.149zm7.563-1.224c-.346-.105-.57-.18-.405-.615.375-.977.42-1.804 0-2.404-.781-1.112-2.915-1.053-5.364-.03 0 0-.766.331-.571-.271.376-1.217.315-2.224-.27-2.809-1.338-1.337-4.869.045-7.888 3.08C1.309 10.87 0 13.273 0 15.348c0 3.981 5.099 6.395 10.086 6.395 6.536 0 10.888-3.801 10.888-6.82 0-1.822-1.547-2.854-2.915-3.284v.01zm1.908-5.092c-.766-.856-1.908-1.187-2.96-.962-.436.09-.706.511-.616.932.09.42.511.691.932.602.511-.105 1.067.044 1.442.465.376.421.466.977.316 1.473-.136.406.089.856.51.992.405.119.857-.105.992-.512.33-1.021.12-2.178-.646-3.035l.03.045zm2.418-2.195c-1.576-1.757-3.905-2.419-6.054-1.968-.496.104-.812.587-.706 1.081.104.496.586.813 1.082.707 1.532-.331 3.185.15 4.296 1.383 1.112 1.246 1.429 2.943.947 4.416-.165.48.106 1.007.586 1.157.479.165.991-.104 1.157-.586.675-2.088.241-4.478-1.338-6.235l.03.045z" },
    zhihu: { box: [0, 0, 24, 24], optical: 0.9, d: "M5.721 0C2.251 0 0 2.25 0 5.719V18.28C0 21.751 2.252 24 5.721 24h12.56C21.751 24 24 21.75 24 18.281V5.72C24 2.249 21.75 0 18.281 0zm1.964 4.078c-.271.73-.5 1.434-.68 2.11h4.587c.545-.006.445 1.168.445 1.171H9.384a58.104 58.104 0 01-.112 3.797h2.712c.388.023.393 1.251.393 1.266H9.183a9.223 9.223 0 01-.408 2.102l.757-.604c.452.456 1.512 1.712 1.906 2.177.473.681.063 2.081.063 2.081l-2.794-3.382c-.653 2.518-1.845 3.607-1.845 3.607-.523.468-1.58.82-2.64.516 2.218-1.73 3.44-3.917 3.667-6.497H4.491c0-.015.197-1.243.806-1.266h2.71c.024-.32.086-3.254.086-3.797H6.598c-.136.406-.158.447-.268.753-.594 1.095-1.603 1.122-1.907 1.155.906-1.821 1.416-3.6 1.591-4.064.425-1.124 1.671-1.125 1.671-1.125zM13.078 6h6.377v11.33h-2.573l-2.184 1.373-.401-1.373h-1.219zm1.313 1.219v8.86h.623l.263.937 1.455-.938h1.456v-8.86z" },
    xiaohongshu: { box: [0, 7.7, 24, 8.6], optical: 0.9, badge: true, d: "M22.405 9.879c.002.016.01.02.07.019h.725a.797.797 0 0 0 .78-.972.794.794 0 0 0-.884-.618.795.795 0 0 0-.692.794c0 .101-.002.666.001.777zm-11.509 4.808c-.203.001-1.353.004-1.685.003a2.528 2.528 0 0 1-.766-.126.025.025 0 0 0-.03.014L7.7 16.127a.025.025 0 0 0 .01.032c.111.06.336.124.495.124.66.01 1.32.002 1.981 0 .01 0 .02-.006.023-.015l.712-1.545a.025.025 0 0 0-.024-.036zM.477 9.91c-.071 0-.076.002-.076.01a.834.834 0 0 0-.01.08c-.027.397-.038.495-.234 3.06-.012.24-.034.389-.135.607-.026.057-.033.042.003.112.046.092.681 1.523.787 1.74.008.015.011.02.017.02.008 0 .033-.026.047-.044.147-.187.268-.391.371-.606.306-.635.44-1.325.486-1.706.014-.11.021-.22.03-.33l.204-2.616.022-.293c.003-.029 0-.033-.03-.034zm7.203 3.757a1.427 1.427 0 0 1-.135-.607c-.004-.084-.031-.39-.235-3.06a.443.443 0 0 0-.01-.082c-.004-.011-.052-.008-.076-.008h-1.48c-.03.001-.034.005-.03.034l.021.293c.076.982.153 1.964.233 2.946.05.4.186 1.085.487 1.706.103.215.223.419.37.606.015.018.037.051.048.049.02-.003.742-1.642.804-1.765.036-.07.03-.055.003-.112zm3.861-.913h-.872a.126.126 0 0 1-.116-.178l1.178-2.625a.025.025 0 0 0-.023-.035l-1.318-.003a.148.148 0 0 1-.135-.21l.876-1.954a.025.025 0 0 0-.023-.035h-1.56c-.01 0-.02.006-.024.015l-.926 2.068c-.085.169-.314.634-.399.938a.534.534 0 0 0-.02.191.46.46 0 0 0 .23.378.981.981 0 0 0 .46.119h.59c.041 0-.688 1.482-.834 1.972a.53.53 0 0 0-.023.172.465.465 0 0 0 .23.398c.15.092.342.12.475.12l1.66-.001c.01 0 .02-.006.023-.015l.575-1.28a.025.025 0 0 0-.024-.035zm-6.93-4.937H3.1a.032.032 0 0 0-.034.033c0 1.048-.01 2.795-.01 6.829 0 .288-.269.262-.28.262h-.74c-.04.001-.044.004-.04.047.001.037.465 1.064.555 1.263.01.02.03.033.051.033.157.003.767.009.938-.014.153-.02.3-.06.438-.132.3-.156.49-.419.595-.765.052-.172.075-.353.075-.533.002-2.33 0-4.66-.007-6.991a.032.032 0 0 0-.032-.032zm11.784 6.896c0-.014-.01-.021-.024-.022h-1.465c-.048-.001-.049-.002-.05-.049v-4.66c0-.072-.005-.07.07-.07h.863c.08 0 .075.004.075-.074V8.393c0-.082.006-.076-.08-.076h-3.5c-.064 0-.075-.006-.075.073v1.445c0 .083-.006.077.08.077h.854c.075 0 .07-.004.07.07v4.624c0 .095.008.084-.085.084-.37 0-1.11-.002-1.304 0-.048.001-.06.03-.06.03l-.697 1.519s-.014.025-.008.036c.006.01.013.008.058.008 1.748.003 3.495.002 5.243.002.03-.001.034-.006.035-.033v-1.539zm4.177-3.43c0 .013-.007.023-.02.024-.346.006-.692.004-1.037.004-.014-.002-.022-.01-.022-.024-.005-.434-.007-.869-.01-1.303 0-.072-.006-.071.07-.07l.733-.003c.041 0 .081.002.12.015.093.025.16.107.165.204.006.431.002 1.153.001 1.153zm2.67.244a1.953 1.953 0 0 0-.883-.222h-.18c-.04-.001-.04-.003-.042-.04V10.21c0-.132-.007-.263-.025-.394a1.823 1.823 0 0 0-.153-.53 1.533 1.533 0 0 0-.677-.71 2.167 2.167 0 0 0-1-.258c-.153-.003-.567 0-.72 0-.07 0-.068.004-.068-.065V7.76c0-.031-.01-.041-.046-.039H17.93s-.016 0-.023.007c-.006.006-.008.012-.008.023v.546c-.008.036-.057.015-.082.022h-.95c-.022.002-.028.008-.03.032v1.481c0 .09-.004.082.082.082h.913c.082 0 .072.128.072.128V11.19s.003.117-.06.117h-1.482c-.068 0-.06.082-.06.082v1.445s-.01.068.064.068h1.457c.082 0 .076-.006.076.079v3.225c0 .088-.007.081.082.081h1.43c.09 0 .082.007.082-.08v-3.27c0-.029.006-.035.033-.035l2.323-.003c.098 0 .191.02.28.061a.46.46 0 0 1 .274.407c.008.395.003.79.003 1.185 0 .259-.107.367-.33.367h-1.218c-.023.002-.029.008-.028.033.184.437.374.871.57 1.303a.045.045 0 0 0 .04.026c.17.005.34.002.51.003.15-.002.517.004.666-.01a2.03 2.03 0 0 0 .408-.075c.59-.18.975-.698.976-1.313v-1.981c0-.128-.01-.254-.034-.38 0 .078-.029-.641-.724-.998z" }
  };
  // The glyph sits at the right end of the avatar row. At ~42% of the avatar
  // (22px next to Paper's 52px avatar) it reads as a source mark, about the
  // cap height of the name, without competing with the author.
  const PLATFORM_ICON_RATIO = 0.42;
  const STAT_KEYS_BY_LABEL = {
    reply: "replies",
    replies: "replies",
    repost: "reposts",
    reposts: "reposts",
    like: "likes",
    likes: "likes",
    bookmark: "bookmarks",
    bookmarks: "bookmarks",
    view: "views",
    views: "views",
    upvote: "upvotes",
    upvotes: "upvotes",
    comment: "comments",
    comments: "comments"
  };

  function t(key, fallback) {
    try {
      const message = root.chrome && chrome.i18n && chrome.i18n.getMessage(key);
      return message || fallback;
    } catch (_) {
      return fallback;
    }
  }

  function resolveStyle(settings) {
    const template = TEMPLATES[settings.template] || TEMPLATES.paper;
    const themeName = settings.theme === "dark" ? "dark" : "light";
    const cardWidth = CANVAS_WIDTH - template.frame * 2;
    return {
      ...template,
      colors: { ...template.palettes[themeName], ...QR_COLORS[themeName] },
      cardWidth,
      contentWidth: cardWidth - template.pad * 2
    };
  }

  function contentParts(tweet) {
    if (tweet.parts && tweet.parts.length) return tweet.parts;
    return [{ text: tweet.text || "", media: tweet.media || [] }];
  }

  async function renderToCanvas(tweet, settings) {
    const style = resolveStyle(settings);
    const parts = [];
    for (const part of contentParts(tweet)) {
      parts.push({ text: part.text || "", media: await loadRenderableImages(part.media || [], style.contentWidth) });
    }
    const avatar = tweet.avatarUrl ? await loadImage(tweet.avatarUrl) : null;
    const measureCtx = document.createElement("canvas").getContext("2d");
    const layout = measureCard(measureCtx, tweet, parts, settings, style);

    // Fixed ratios pad short cards (content centred) and shrink tall ones to fit.
    const targetHeight = ratioHeight(settings.ratio);
    const height = targetHeight || layout.canvasHeight;
    const fit = targetHeight ? Math.min(1, targetHeight / layout.canvasHeight) : 1;

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(CANVAS_WIDTH * EXPORT_SCALE);
    canvas.height = Math.ceil(height * EXPORT_SCALE);
    const ctx = canvas.getContext("2d");
    ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
    drawBackdrop(ctx, height, style);
    ctx.save();
    ctx.translate((CANVAS_WIDTH * (1 - fit)) / 2, (height - layout.canvasHeight * fit) / 2);
    ctx.scale(fit, fit);
    drawCard(ctx, tweet, avatar, layout, settings, style);
    ctx.restore();
    drawBorder(ctx, height, style);
    return canvas;
  }

  function ratioHeight(ratio) {
    const match = /^(\d+):(\d+)$/.exec(String(ratio || ""));
    return match ? Math.round((CANVAS_WIDTH * Number(match[2])) / Number(match[1])) : 0;
  }

  function drawBackdrop(ctx, height, style) {
    const { colors } = style;
    if (style.frame) {
      const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, height);
      gradient.addColorStop(0, colors.frame[0]);
      gradient.addColorStop(1, colors.frame[1]);
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = colors.background;
    }
    ctx.fillRect(0, 0, CANVAS_WIDTH, height);
  }

  function drawBorder(ctx, height, style) {
    if (style.frame || !style.colors.border) return;
    ctx.strokeStyle = style.colors.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, CANVAS_WIDTH - 1, height - 1);
  }

  async function renderToPng(tweet, settings) {
    return canvasToBlob(await renderToCanvas(tweet, settings));
  }

  async function loadRenderableImages(media, width) {
    const loaded = [];
    for (const item of media) {
      const image = await loadImage(item.src);
      if (!image || !image.naturalWidth) continue;
      const naturalHeight = Math.round((width * image.naturalHeight) / image.naturalWidth);
      loaded.push({ image, width, height: Math.min(naturalHeight, Math.round(width * MAX_MEDIA_RATIO)) });
    }
    return loaded;
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });
  }

  function hasQr(tweet, settings) {
    return Boolean(settings.showQrCode && tweet.sourceUrl);
  }

  // Layout is a flat list of positioned blocks (relative to the card's top-left)
  // so every template shares one measuring pass and one drawing pass.
  function measureCard(ctx, tweet, parts, settings, style) {
    const blocks = [];
    const width = style.contentWidth;
    let y = style.pad + (style.accentBar || 0);

    if (style.header === "top") {
      blocks.push({ type: "header", y });
      y += style.avatarSize + 28;
    }

    if (style.quoteMark) {
      blocks.push({ type: "quote", y });
      y += 58;
    }

    if (tweet.title) {
      ctx.font = style.title.font;
      const lines = wrapParagraphs(ctx, tweet.title, width);
      blocks.push({ type: "lines", y, lines, font: style.title.font, lineHeight: style.title.lineHeight, color: "name" });
      y += lines.length * style.title.lineHeight;
      if (parts.some((part) => part.text || part.media.length)) y += 16;
    }

    parts.forEach((part, index) => {
      if (index > 0) {
        y += 22;
        blocks.push({ type: "divider", y });
        y += 24;
      }

      if (part.text) {
        ctx.font = style.body.font;
        const lines = wrapParagraphs(ctx, part.text, width);
        blocks.push({ type: "lines", y, lines, font: style.body.font, lineHeight: style.body.lineHeight, color: "text" });
        y += lines.length * style.body.lineHeight;
      }

      if (part.media.length) {
        if (part.text) y += 26;
        for (const item of part.media) {
          blocks.push({ type: "media", y, item });
          y += item.height + MEDIA_GAP;
        }
        y -= MEDIA_GAP;
      }
    });

    if (style.header === "bottom") {
      y += 34;
      blocks.push({ type: "header", y });
      y += style.avatarSize;
    }

    y += 30;
    blocks.push({ type: "rule", y });
    y += 18;

    const qr = hasQr(tweet, settings);
    ctx.font = footerFont();
    const footerLines = wrapFooterText(ctx, buildFooterItems(tweet, settings), qr ? width - QR_CODE_SIZE - 22 : width);
    const footerHeight = Math.max(footerLines.length * 20, qr ? QR_CODE_SIZE : 20);
    blocks.push({ type: "footer", y, lines: footerLines, height: footerHeight });
    y += footerHeight + style.pad;

    const cardHeight = Math.ceil(y);
    return { blocks, cardHeight, canvasHeight: cardHeight + style.frame * 2 };
  }

  function drawCard(ctx, tweet, avatar, layout, settings, style) {
    const { colors } = style;
    const x0 = style.frame;
    const y0 = style.frame;

    if (style.frame) {
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.22)";
      ctx.shadowBlur = 36;
      ctx.shadowOffsetY = 14;
      ctx.fillStyle = colors.background;
      roundedRectPath(ctx, x0, y0, style.cardWidth, layout.cardHeight, style.radius);
      ctx.fill();
      ctx.restore();
    }

    if (style.accentBar) {
      ctx.fillStyle = colors.accent;
      ctx.fillRect(x0, y0, style.cardWidth, style.accentBar);
    }

    const left = x0 + style.pad;
    const right = x0 + style.cardWidth - style.pad;
    ctx.textBaseline = "top";

    for (const block of layout.blocks) {
      const y = y0 + block.y;
      if (block.type === "header") {
        drawHeader(ctx, tweet, avatar, left, y, style, platformIcon(tweet, settings));
      } else if (block.type === "quote") {
        ctx.fillStyle = colors.accent;
        ctx.font = `700 96px ${SERIF}`;
        ctx.fillText("“", left - 4, y - 14);
      } else if (block.type === "lines") {
        ctx.fillStyle = colors[block.color];
        ctx.font = block.font;
        block.lines.forEach((line, index) => ctx.fillText(line, left, y + index * block.lineHeight));
      } else if (block.type === "media") {
        drawRoundedImage(ctx, block.item.image, left, y, block.item.width, block.item.height, 10);
      } else if (block.type === "divider") {
        ctx.fillStyle = colors.line;
        for (let dot = 0; dot < 3; dot += 1) {
          ctx.beginPath();
          ctx.arc(left + 4 + dot * 14, y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (block.type === "rule") {
        ctx.strokeStyle = colors.line;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(left, y + 0.5);
        ctx.lineTo(right, y + 0.5);
        ctx.stroke();
      } else if (block.type === "footer") {
        ctx.fillStyle = colors.footer;
        ctx.font = footerFont();
        block.lines.forEach((line, index) => ctx.fillText(line, left, y + index * 20));
        if (hasQr(tweet, settings)) {
          drawQrCode(ctx, tweet.sourceUrl, right - QR_CODE_SIZE, y + (block.height - QR_CODE_SIZE) / 2, QR_CODE_SIZE, colors);
        }
      }
    }
  }

  function platformIcon(tweet, settings) {
    if (settings.showPlatformIcon === false || typeof Path2D === "undefined") return null;
    return (tweet.platform && PLATFORM_ICONS[tweet.platform]) || null;
  }

  // Draws the mark so its ink is centred on (cx, cy) and its longer side is
  // `size` (scaled by the optical factor).
  function drawPlatformIcon(ctx, icon, cx, cy, size, colors) {
    const extent = size * (icon.optical || 1);
    ctx.save();
    if (icon.badge) {
      ctx.fillStyle = colors.handle;
      roundedRectPath(ctx, cx - extent / 2, cy - extent / 2, extent, extent, extent * 0.24);
      ctx.fill();
    }
    const [bx, by, bw, bh] = icon.box;
    const inner = icon.badge ? extent * 0.86 : extent;
    const scale = inner / Math.max(bw, bh);
    ctx.translate(cx - (bx + bw / 2) * scale, cy - (by + bh / 2) * scale);
    ctx.scale(scale, scale);
    ctx.fillStyle = icon.badge ? colors.background : colors.handle;
    ctx.fill(new Path2D(icon.d));
    ctx.restore();
  }

  function footerFont() {
    return `14px ${SANS}`;
  }

  function drawHeader(ctx, tweet, avatar, x, y, style, icon) {
    const { colors } = style;
    const size = style.avatarSize;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    if (avatar) {
      ctx.clip();
      ctx.drawImage(avatar, x, y, size, size);
    } else {
      ctx.fillStyle = colors.avatar;
      ctx.fill();
      ctx.fillStyle = colors.avatarText;
      ctx.font = `700 ${Math.round(size * 0.46)}px ${SANS}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const initial = [...String(tweet.authorName || "X").replace(/^[ru]\//i, "")][0] || "X";
      ctx.fillText(initial.toUpperCase(), x + size / 2, y + size / 2 + 1);
    }
    ctx.restore();

    const iconSize = Math.round(size * PLATFORM_ICON_RATIO);
    if (icon) {
      // Mirrors the avatar: the mark's centre sits as far from the right edge
      // as the avatar's centre does from the left, on the same horizontal axis.
      // Muted like the handle so it never outweighs the name.
      drawPlatformIcon(ctx, icon, x + style.contentWidth - size / 2, y + size / 2, iconSize, colors);
    }

    const textX = x + size + 14;
    const maxWidth = style.contentWidth - size - 14 - (icon ? size / 2 + iconSize / 2 + 16 : 0);
    const nameSize = size >= 50 ? 20 : 18;
    ctx.textBaseline = "top";
    ctx.fillStyle = colors.name;
    ctx.font = `700 ${nameSize}px ${SANS}`;
    const nameY = tweet.authorHandle ? y + size / 2 - nameSize - 1 : y + (size - nameSize) / 2;
    ctx.fillText(truncateText(ctx, tweet.authorName, maxWidth), textX, nameY);

    if (tweet.authorHandle) {
      ctx.fillStyle = colors.handle;
      ctx.font = `15px ${SANS}`;
      ctx.fillText(truncateText(ctx, tweet.authorHandle, maxWidth), textX, y + size / 2 + 3);
    }
  }

  function wrapParagraphs(ctx, text, maxWidth) {
    const lines = [];
    for (const paragraph of String(text).split("\n")) lines.push(...wrapText(ctx, paragraph, maxWidth));
    return lines;
  }

  function wrapText(ctx, text, maxWidth) {
    if (typeof core.wrapCardText === "function") return core.wrapCardText(ctx, text, maxWidth);
    return [String(text || "")];
  }

  function truncateText(ctx, text, maxWidth) {
    const value = String(text || "");
    if (ctx.measureText(value).width <= maxWidth) return value;

    let chars = [...value];
    while (chars.length && ctx.measureText(`${chars.join("")}…`).width > maxWidth) chars = chars.slice(0, -1);
    return `${chars.join("")}…`;
  }

  function drawRoundedImage(ctx, image, x, y, width, height, radius) {
    const sourceHeight = Math.min(image.naturalHeight, (image.naturalWidth * height) / width);
    ctx.save();
    roundedRectPath(ctx, x, y, width, height, radius);
    ctx.clip();
    ctx.drawImage(image, 0, 0, image.naturalWidth, sourceHeight, x, y, width, height);
    ctx.restore();
  }

  function roundedRectPath(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function buildFooterItems(tweet, settings) {
    const selected = new Set(settings.footerFields || []);
    const items = [];
    if (selected.has("date") && tweet.createdAtLabel) items.push(tweet.createdAtLabel);

    for (const stat of tweet.stats || []) {
      const key = STAT_KEYS_BY_LABEL[String(stat.label || "").toLowerCase()];
      if (key && selected.has(key) && stat.value) items.push(`${stat.value} ${t(`stat_${key}`, stat.label)}`);
    }

    // The platform glyph replaces the domain; plain web pages keep their domain.
    if (tweet.sourceLabel && !platformIcon(tweet, settings)) items.push(tweet.sourceLabel);
    if (settings.showBranding) items.push(t("brandLine", "Made with PaperCard"));
    return items.length ? items : [t("footerFallback", "Share card")];
  }

  function wrapFooterText(ctx, chunks, maxWidth) {
    const lines = [];
    let line = "";

    for (const chunk of chunks) {
      const candidate = line ? `${line} · ${chunk}` : chunk;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = chunk;
      } else {
        line = candidate;
      }
    }

    if (line) lines.push(line);
    return lines;
  }

  function drawQrCode(ctx, url, x, y, size, colors) {
    if (typeof root.qrcode !== "function") return;

    const qr = root.qrcode(0, "M");
    qr.addData(url);
    qr.make();

    const count = qr.getModuleCount();
    const quiet = 4;
    const cell = size / (count + quiet * 2);

    ctx.fillStyle = colors.qrBackground;
    roundedRectPath(ctx, x, y, size, size, 8);
    ctx.fill();
    ctx.strokeStyle = colors.qrBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = colors.qrForeground;
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (!qr.isDark(row, col)) continue;
        ctx.fillRect(x + (col + quiet) * cell, y + (row + quiet) * cell, Math.ceil(cell), Math.ceil(cell));
      }
    }
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Canvas export failed"))), "image/png");
    });
  }

  root.PaperCardRenderer = { renderToCanvas, renderToPng, TEMPLATE_NAMES: Object.keys(TEMPLATES) };
})(typeof globalThis !== "undefined" ? globalThis : this);
