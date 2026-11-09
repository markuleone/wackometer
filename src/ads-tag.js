// Google AdSense: the publisher ID is public (it sits in every page that shows ads).
// The tag goes straight into each content page's <head> so Google's site check can find it.
// Ad requests start paused; /js/ads.js un-pauses them for everyone except Wingman Pro members.
export const ADSENSE_CLIENT = "ca-pub-6154120555777230";
export const adsenseTag = () => `<script>(window.adsbygoogle=window.adsbygoogle||[]).pauseAdRequests=1</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>`;
