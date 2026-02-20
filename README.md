<div align='center'>
    <h1>searchtify</h1>
    <h3>a search package for spotify that requires no credentials!</h3>
</div>

<br><br><h2 align='center'>disclaimer</h2>

the point of this package is NOT to provide some sort of "clean" API for spotify searching. maybe in the future.

the point of this package is to provide a wrapper for spotify's complex API. they are constantly changing parameters and endpoints. it's actually kind of annoying.

that being said, as of searchtify 2.0, it is typed! any modern IDE should give you suggestions that come directly from the API.

<br><br><h2 align='center'>usage</h2>

usage is relatively simple:

```js
import Spotify from 'searchtify';

const spotify = new Spotify();

const search = await spotify.search('Blinding Lights');
console.log(search.tracksV2.items[0].item.data);
```

and its album:
```js
// uri format: spotify:album:4yP0hdKOZPNshxUOjY0cZj
const album = await spotify.getAlbum(search.tracksV2.items[0].item.data.albumOfTrack.uri);
console.log(album);
```

or, for example, an artist:

```js
// uri format: spotify:artist:1Xyo4u8uXC1ZmMpatF05PJ (my goat the weeknd)
const artist = await spotify.getArtist(search.tracksV2.items[0].item.data.artists.items[0].uri);
console.log(artist);
```

you can limit searches to X number of things PER CATEGORY, which in testing notably does not make any impact on response times:

```js
const search2 = await spotify.search('Hurry Up Tomorrow', { limit: 25 });
console.log(search2.tracksV2.items);
```

that would return 25 albums, 25 songs, etc

*notable* parameters include:

- `limit` - number - the limit of results for each items array
- `offset` - number - the offset to start at
- `numberOfTopResults` - number - the number of items in `topResultsV2`

if there's something you need from here, enable it as part of the search parameters

you can also search for the things on the homepage:

```js
const popular = await spotify.getPopular();
console.log(popular[0].data.title.translatedBaseText + ':');
console.log(popular[0].sectionItems.items[0].content.data);
```

the structure of the response is the homepage categories and data going down.

`getPopular` accepts one argument, which is a timezone in the format of "America/New_York".

it defaults to the user's timezone.

you can set a custom user agent using `setUserAgent`:

```js
spotify.setUserAgent('putting something like this in the useragent will probably flag your IP');
```

<br><br><h2 align='center'>credits</h2>

the secrets directory of this repository is code created by <a href='https://github.com/Thereallo1026'>Thereallo1026</a> (repository deleted)<br>
the original proof of concept was created by <a href='https://github.com/misiektoja/spotify_monitor/blob/dev/debug/spotify_monitor_secret_grabber.py'>Michal Szymanski</a><br>
the types come from <a href='https://github.com/NuclearPlayer'>NuclearPlayer</a>, which was created by <a href='https://github.com/nukeop'>nukeop</a><br><br>

thanks to all of you; y'all rock!

<br><br>
<h5 align='center'>made with ❤️</h5>
