const express = require('express')
const proxy = require('express-http-proxy')
const fs = require('fs')
const url = require('url')
const staticHeaders = JSON.parse(fs.readFileSync('config/static_headers.json'))
const prefs = JSON.parse(fs.readFileSync('config/prefs.json'))
const tokenFilename = prefs['token_path']
let tokens = JSON.parse(fs.readFileSync(tokenFilename))

fs.watchFile(tokenFilename, (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
        tokens = JSON.parse(fs.readFileSync(tokenFilename))
        console.log('Tokens reloaded.')
    }
})

function RequestOptionsDecorator(proxyReqOpts, srcReq) {
    return new Promise ((resolve, reject) => {
        for (let headerKey in staticHeaders) {
            proxyReqOpts.headers[headerKey] = staticHeaders[headerKey]
        }
        proxyReqOpts.headers['Authorize'] = `consumerKey=lovelive_test&token=${tokens.token}&version=1.1&timeStamp=${Date.now() / 1000 | 0}&nonce=WV${0}`
        proxyReqOpts.headers['User-ID'] = tokens.userId
        proxyReqOpts.headers['User-Agent'] = 'Mozilla/5.0 (Linux; Android 7.1.1; Nexus 5X Build/N4F26I) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.91 Mobile Safari/537.36'
        resolve(proxyReqOpts)
    })
}

function RequestPathResolver (req) {
    return new Promise(function (resolve, reject) {
        resolve(`/webview.php${url.parse(req.url).path}`)
    })
}

let gaCode = `
<script>
  (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
  (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
  })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');

  ga('create', '${prefs['google_analytics_id']}', 'auto');
  ga('send', 'pageview');

</script>
`

function ResponseDecorator (proxyRes, proxyResData) {
    return new Promise(function (resolve, reject) {
        let proxyResDataString = proxyResData.toString('utf-8')
        proxyResDataString = proxyResDataString.replace('<script src="//cf-static-prod.lovelive.ge.klabgames.net/resources/js/button.js?r=20161109"></script>', '<script src="/resources/js/button.js?r=20161109"></script>')
        proxyResDataString = proxyResDataString.replace('<link rel="stylesheet" href="//cf-static-prod.lovelive.ge.klabgames.net/resources/css/news/list.css">', '<link rel="stylesheet" href="/resources/css/news/list.css">')
        proxyResDataString = proxyResDataString.replace('<link rel="stylesheet" href="//cf-static-prod.lovelive.ge.klabgames.net/resources/css/news/detail.css?r=20170520">', '<link rel="stylesheet" href="/resources/css/news/detail.css?r=20170520">')
        proxyResDataString = proxyResDataString.replace('<link rel="stylesheet" href="//cf-static-prod.lovelive.ge.klabgames.net/resources/css/perfect-scrollbar.css?r=20170520">', '<!--link rel="stylesheet" href="//cf-static-prod.lovelive.ge.klabgames.net/resources/css/perfect-scrollbar.css?r=20170520"-->')
        proxyResDataString = proxyResDataString.replace('<script src="//cf-static-prod.lovelive.ge.klabgames.net/resources/js/perfect-scrollbar.min.js"></script>', '<!--script src="//cf-static-prod.lovelive.ge.klabgames.net/resources/js/perfect-scrollbar.min.js"></script-->')
        proxyResDataString = proxyResDataString.replace("Ps.initialize(document.getElementById('container'), {suppressScrollX: true});", "// Ps.initialize(document.getElementById('container'), {suppressScrollX: true});")
        proxyResDataString = proxyResDataString.replace("Ps.initialize(document.getElementById('body'), {suppressScrollX: true});", "Ps.initialize(document.getElementById('body'), {suppressScrollX: true});")
        proxyResDataString = proxyResDataString.replace('</body>', '</body>\n' + gaCode)
        proxyResDataString = proxyResDataString.replace('-webkit-user-select:none;', '')
        resolve(Buffer.from(proxyResDataString, 'utf-8'))
    })
}

let app = express()
let options = {
    //https: true,
    //preserveHostHdr: true,
    parseReqBody: true,
    reqBodyEncoding: 'utf-8',
    proxyReqOptDecorator: RequestOptionsDecorator,
    proxyReqPathResolver: RequestPathResolver,
    userResDecorator: ResponseDecorator,
    //proxyReqBodyDecorator: RequestBodyDecorator
}

app.get('/', function (req, res) {
    res.redirect('/webview.php/announce')
})
app.use('/resources', express.static('static/resources'))
app.use('/webview.php', proxy('prod-jp.lovelive.ge.klabgames.net', options))
app.listen(32816, 'localhost')