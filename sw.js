const CACHE_VERSION = 'gamedaywx-v3';
// ...
const isApiRequest =
  url.hostname.includes('open-meteo.com') ||
  url.hostname.includes('espn.com') ||
  url.hostname.includes('collegefootballdata.com');