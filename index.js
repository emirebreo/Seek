const http = require("http");
const fs = require("fs");
const { parse } = require("url");
const got = require("got");
const cheerio = require("cheerio");
const bing = require("bing-scraper");
const fv = require("retrieve-favicon");
const lw = require("lycos-weather");
const ytdl = require("ytdl-core");
const ftl = require("findthelyrics");
const lex = require("lexico-dictionary");
const port = process.env.PORT || 7070;

http.createServer(requestListener).listen(port);
console.log("Server is listening on port " + port);

async function requestListener(request, response) {
    var url = parse(request.url, true);
    if (fs.existsSync(__dirname + "/web/static" + url.pathname + "index.html")) {
        fs.readFile(__dirname + "/web/static" + url.pathname + "index.html", function (err, resp) {
            if (err) {
                handleError(request, response, err);
            } else {
                response.writeHead(200, {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "text/html"
                });
                response.end(resp);
            }
        });
    } else if (fs.existsSync(__dirname + "/web/static" + url.pathname)) {
        fs.readFile(__dirname + "/web/static" + url.pathname, function (err, resp) {
            if (err) {
                handleError(request, response, err);
            } else {
                response.writeHead(200, {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": contentType(url.pathname)
                });
                response.end(resp);
            }
        });
    } else {
        var pathClean = url.pathname.split("/").slice(1);
        var path = url.pathname;
        switch(pathClean[0]) {
            case "search":
                if (!pathClean[1]) {
                    if (url.query.q) {
                        if (request.headers["accept-language"]) {var l = request.headers["accept-language"];}
                        else if (request.headers["Accept-Language"]) {var l = request.headers["Accept-Language"];}
                        else {var l = "en-US,en;q=0.5";}
                        
                        bing.getCookies(null, function(err, res) {
                            if (!url.query.cook) {
                                if (err) {
                                    var cook = null;
                                } else {
                                    var cook = res;
                                }
                            } else {
                                var cook = atob(url.query.cook);
                            }
                            
                            if (url.query.scrape) {
                                var scrapeUrl = atob(url.query.scrape);
                                var object = {
                                    url: scrapeUrl,
                                    pageCount: 3,
                                    lang: l,
                                    cookieString: cook
                                }
                            } else {
                                var object =  {
                                    q: url.query.q,
                                    pageCount: 3,
                                    lang: l,
                                    cookieString: cook
                                }
                            }

                            bing.search(object, function(err, res) {
                                if (err) {
                                    handleError(request, response, err);
                                } else {
                                    if (res.results.length == 0) {
                                        fs.readFile(__dirname + "/web/dynamic/search/no-results/index.html", function(err, resp) {
                                            if (err) {
                                                handleError(request, response, err);
                                            } else {
                                                var $ = cheerio.load(resp);
                                                $("#q").text(escapeHtml(url.query.q));
                                                $('#searchBox').val(url.query.q);
                                                $("title").text("Results for \"" + url.query.q + "\" on Seekly");
                                                response.writeHead(200, {
                                                    "Accept-Control-Allow-Origin": "*",
                                                    "Content-Type": "text/html"
                                                });
                                                response.end($.html());
                                            }
                                        });
                                        return;
                                    }
                                    fs.readFile(__dirname + "/web/dynamic/search/index.html", function(err, resp) {
                                        if (err) {
                                            handleError(request, response, err);
                                        } else {
                                            var $ = cheerio.load(resp);
                                            $('#searchBox').val(url.query.q);
                                            $("title").text("Results for \"" + url.query.q + "\" on Seekly");
                                            
                                            // definition adding
                                            if (
                                                url.query.q.includes("definition") ||
                                                url.query.q.includes("meaning")
                                            ) {
                                                var d = `
                                                    <div class='dontPush widgetResult result'>
                                                        <iframe scrolling='yes' class='widget definition' src='/dict?w=${url.query.q}'></iframe>
                                                    </div>
                                                `;
                                                $(".results").append(d);
                                            }

                                            // video adding
                                            if (res.videoObject !== null && res.videoObject.url !== null && ytdl.validateURL(res.videoObject.url)) {
                                                var ew = `
                                                    <div class='dontPush widgetResult result'>
                                                        <iframe scrolling='yes' class='widget embed' src='/embed?id=${ytdl.getURLVideoID(res.videoObject.url)}'></iframe>
                                                        <h2>${res.videoObject.title}</h2>
                                                        <p>${res.videoObject.meta}</p>
                                                    </div>
                                                `;
                                                $(".results").append(ew);
                                            }

                                            // dym adding
                                            if (res.didyoumean !== null) {
                                                $(".dym").attr("href", "/search?q=" + encodeURIComponent(res.didyoumean.query));
                                                $(".dym").text(res.didyoumean.query);
                                                $(".results").attr("style", "padding-top:10px !important;")
                                            } else {
                                                $(".dymCont").remove();
                                            }

                                            // main result adding
                                            if (res.qnaAnswer !== null && res.qnaAnswer.answer !== "") {
                                                var bChip = "<div class='qnaResult dontPush result'><p>" + escapeHtml(res.qnaAnswer.answer) + "</p><a class='resLink' href='" + escapeHtml(res.qnaAnswer.source.url) + "'><h2>" + escapeHtml(res.qnaAnswer.source.title) + "</h2><h4>" + escapeHtml(res.qnaAnswer.source.url) + "</h4></a></div>";
                                                $(".results").append(bChip);
                                            } else if (res.topAnswer !== null) {
                                                if (res.topAnswer.image !== null) {
                                                    var bChip = "<div class='topResult dontPush result'><img src='/proxy?url=" + btoa(res.topAnswer.image) + "'><div><h4>" + escapeHtml(res.topAnswer.title) + "</h4><h2>" + escapeHtml(res.topAnswer.answer) + "</h2><div></div>"
                                                } else {
                                                    var bChip = "<div class='topResult dontPush result'><h4>" + escapeHtml(res.topAnswer.title) + "</h4><h2>" + escapeHtml(res.topAnswer.answer) + "</h2></div>"
                                                }
                                                $(".results").append(bChip);
                                            }
            
                                            // prev/next buttons
                                            if (res.nextHref !== null) {
                                                $("#more").attr("href",  "/search?q=" + url.query.q + "&scrape=" + btoa(res.nextHref) + "&cookies=" + btoa(cook));
                                            } else {
                                                $("#more").remove();
                                            }
                                            if (res.prevHref !== null && url.query.scrape) {
                                                $("#prev").attr("href",  "/search?q=" + url.query.q + "&scrape=" + btoa(res.prevHref) + "&cookies=" + btoa(cook));
                                            } else {
                                                $("#prev").remove();
                                            }

                                            // linking image results
                                            $("#imgTab").attr("href", "/search/images?q=" + url.query.q + "&cookies=" + btoa(cook));
            
                                            // suggested results adding
                                            for (var c in res.suggestedQueries) {
                                                var q = `
                                                    <a rel='noopener noreferrer' href='/search/?q=${encodeURIComponent(parse(res.suggestedQueries[c].url, true).query.q)}&scrape=${btoa(res.suggestedQueries[c].url)}'>
                                                        <button>${res.suggestedQueries[c].query}</button>
                                                    </a>
                                                `;
                                                $(".suggested").append(q);
                                            }
                                            if (res.suggestedQueries.length == 0) {$(".suggested").remove();}

                                            // carousel adding
                                            if (res.carousel !== null && res.carousel !== undefined) {
                                                if (res.carousel.cards && res.carousel.cards.length > 0) {
                                                    var caroTitle = `<h2>${res.carousel.title}</h2>`;
                                                    $(".carousel").append(caroTitle);
                                                    for (var c in res.carousel.cards) {
                                                        var ca = `
                                                            <a rel='noopener noreferrer' href='/search?q=${encodeURIComponent(parse(res.carousel.cards[c].url, true).query.q)}&scrape=${btoa(res.carousel.cards[c].url)}'>
                                                                <div class='chip'>
                                                                    <img src='/proxy?url=${btoa(res.carousel.cards[c].image)}'>
                                                                    <p>${res.carousel.cards[c].content}</p>
                                                                </div>
                                                            </a>
                                                        `;
                                                        $(".carousel").append(ca);
                                                    }
                                                } else {
                                                    $(".carousel").remove();
                                                }
                                            } else {
                                                $(".carousel").remove();
                                            }

                                            // weather adding
                                            if (
                                                url.query.q.includes("weather in my area") ||
                                                url.query.q.includes("weather near me") ||
                                                url.query.q.includes("weather in my town") ||
                                                url.query.q.includes("weather in my city") ||
                                                url.query.q.includes("weather for my town") ||
                                                url.query.q.includes("weather for my city") ||
                                                url.query.q.includes("weather here") ||
                                                url.query.q.includes("what is the weather") ||
                                                url.query.q.includes("what's the weather") ||
                                                url.query.q.includes("whats the weather")
                                            ) {
                                                var ww = `<div class='widgetResult dontPush result'><iframe scrolling='yes' class='widget weather' src='/weather'></iframe></div>`;
                                                $(".results").append(ww);
                                            } else if (
                                                url.query.q.includes("weather in ") && !url.query.q.includes("my city") && !url.query.q.includes("my town") || 
                                                url.query.q.includes("weather for ") && !url.query.q.includes("my city") && !url.query.q.includes("my town") 
                                            ) {
                                                if (url.query.q.includes("weather in ")) {var splitString = "weather in ";}
                                                if (url.query.q.includes("weather for ")) {var splitString = "weather for";}
                                                if (url.query.q.split(splitString).length > 1) {
                                                    var ww = `<div class='dontPush widgetResult result'><iframe scrolling='yes' class='widget weather' src='/weather?q=${encodeURIComponent(url.query.q.split(splitString).slice(1).join(splitString))}'></iframe></div>`;
                                                    $(".results").append(ww);
                                                }
                                            }

                                            // sidebar adding
                                            if (res.sidebar) {
                                                if (res.sidebar.snippet !== null) {
                                                    var foot = "";
                                                    for (var c in res.sidebar.footnotes) {
                                                        if (res.sidebar.footnotes[c].content == "Suggest an edit") {continue;}
                                                        var foot = foot + "<br><a rel='nofollow noreferrer' href='" + res.sidebar.footnotes[c].url + "'><i>" + res.sidebar.footnotes[c].content +"</i></a>";
                                                    }
                                                    if (res.sidebar.image !== null) {
                                                        var s = `
                                                            <div class='sidebar'>
                                                                <h2>${res.sidebar.title}</h2>
                                                                <h4>${res.sidebar.subtitle}</h4>
                                                                <div class='sbs'>
                                                                    <img align='right' src='/proxy?url=${btoa(res.sidebar.image)}'>
                                                                    <p>${res.sidebar.snippet}</p>
                                                                </div>
                                                                <div class='footnotes'>${foot}</div>
                                                            </div>
                                                        `;
                                                    } else {
                                                        var s = `
                                                            <div class='sidebar'>
                                                                <h2>${res.sidebar.title}</h2>
                                                                <h4>${res.sidebar.subtitle}</h4>
                                                                <div class='sbs'>
                                                                    <p>${res.sidebar.snippet}</p>
                                                                </div>
                                                                <div class='footnotes'>${foot}</div>
                                                            </div>
                                                        `;
                                                    }
                                                    
                                                    $(".side").append(s);
                                                }
                                            }

                                            // web result adding
                                            for (var c in res.results) {
                                                var chip = `
                                                <div class='resultContainer'>
                                                    <div class='buttonColumn'>
                                                        <a rel='noopener noreferrer' href='/proxy?url=${btoa(res.results[c].url)}'>
                                                            <img src='/proxy.png' class='resultButton'>
                                                        </a>
                                                        <a rel='noopener noreferrer' href='https://web.archive.org/*/${escapeHtml(res.results[c].url)}'>
                                                            <img src='/back.png' class='resultButton'>
                                                        </a>
                                                    </div>
                                                    <a class='resLink' rel='noopener noreferrer' href='${escapeHtml(res.results[c].url)}'>
                                                        <div class='result'>
                                                            <h2>${escapeHtml(res.results[c].title)}</h2>
                                                            <div class='urlCont'>
                                                                <img class='favicon' src='/favicon/?link=${btoa(res.results[c].url)}'>
                                                                <h4>${escapeHtml(res.results[c].url)}</h4>
                                                            </div>
                                                            <p>${escapeHtml(res.results[c].description)}</p>
                                                        </div>
                                                  </a>
                                                </div>`;
                                                $(".results").append(chip);
                                            }
            
                                            response.writeHead(200, {
                                                "Accept-Control-Allow-Origin": "*",
                                                "Content-Type": "text/html"
                                            });
                                            response.end($.html());
                                        }
                                    });
                                }
                            });
                        });
                    } else {
                        response.writeHead(302, {
                            "Access-Control-Allow-Origin": "*",
                            "Location": "/"
                        })
                        response.end();
                    }
                } else if (pathClean[1] == "images") {
                    if (request.headers["accept-language"]) {var l = request.headers["accept-language"];}
                    else if (request.headers["Accept-Language"]) {var l = request.headers["Accept-Language"];}
                    else {var l = "en-US,en;q=0.5";}
    
                    bing.getCookies(null, function(err, res) {
                        if (!url.query.cookies) {
                            if (err) {
                                var cook = null;
                            } else {
                                var cook = res;
                            }
                        } else {
                            var cook = atob(url.query.cookies);
                        }
                        
                        if (url.query.scrape) {
                            var scrapeUrl = atob(url.query.scrape);
                            var object = {
                                url: scrapeUrl,
                                pageCount: 3,
                                lang: l,
                                cookieString: cook
                            };
                        } else {
                            var object =  {
                                q: url.query.q,
                                pageCount: 3,
                                lang: l,
                                cookieString: cook
                            };
                        }

                        bing.imageSearch(object, function(err, resp) {
                            if (err) {
                                handleError(request, response, err);
                            } else {
                                if (resp.results.length == 0) {
                                    fs.readFile(__dirname + "/web/dynamic/search/no-results/index.html", function(err, res) {
                                        if (err) {
                                            handleError(request, response, err);
                                        } else {
                                            var $ = cheerio.load(res);
                                            $("#q").text(escapeHtml(url.query.q));
                                            $('#searchBox').val(url.query.q);
                                            $("title").text("Results for \"" + url.query.q + "\" on Seekly");
                                            response.writeHead(200, {
                                                "Accept-Control-Allow-Origin": "*",
                                                "Content-Type": "text/html"
                                            });
                                            response.end($.html());
                                        }
                                    });
                                    return;
                                }
                                fs.readFile(__dirname + "/web/dynamic/search/images/index.html", function(err, res) {
                                    if (err) {
                                        handleError(request, response, err);
                                    } else {
                                        var $ = cheerio.load(res);
                                        $('#searchBox').val(url.query.q);
                                        $("title").text("Results for \"" + url.query.q + "\" on Seekly");
    
                                        // image results adding
                                        for (var c in resp.results) {
                                            var chip = `
                                                <div class='imageContainer' title='${resp.results[c].title}'>
                                                    <img src='/proxy/?url=${btoa(resp.results[c].thumbnail)}'>
                                                    <div class='sourceTxt'>
                                                        <a href='${resp.results[c].source}' rel='noopener noreferrer'>Source</a> -
                                                        <a href='/proxy?url=${btoa(resp.results[c].direct)}' rel='noopener noreferrer'>Direct</a> (<a rel='noopener noreferrer' href='${resp.results[c].direct}'>Unproxied</a>)
                                                    </div>
                                                </div>
                                            `;
                                            if ((c / 5).toString().split(".").length == 1) {
                                                $("#splitA").append(chip);
                                            } else {
                                                var a = (c / 5).toString().split(".")[1];
                                                if (a == "2") {
                                                    $("#splitB").append(chip);
                                                } else if (a == "4") {
                                                    $("#splitC").append(chip);
                                                } else if (a == "6") {
                                                    $("#splitD").append(chip);
                                                } else {
                                                    $("#splitE").append(chip);
                                                }
                                            }
                                        }

                                        // add next page
                                        if (resp.nextUrl !== null && resp.nextUrl !== undefined) {
                                            $("#more").attr("href",  "/search/images?q=" + url.query.q + "&scrape=" + btoa(resp.nextUrl) + "&cookies=" + btoa(cook));
                                        } else {
                                            $("#more").remove();
                                        }

                                        // linking image results
                                        $("#webTab").attr("href", "/search?q=" + url.query.q + "&cookies=" + btoa(cook));

                                        response.writeHead(200, {
                                            "Accept-Control-Allow-Origin": "*",
                                            "Content-Type": "text/html"
                                        });
                                        response.end($.html());
                                    }
                                });
                            }
                        });
                    });
                } else {
                    fs.readFile(__dirname + "/web/dynamic/error/404.html", function(err, resp) {
                        if (err) {
                            handleError(request, response, err);
                        } else {
                            response.writeHead(404, {
                                "Access-Control-Allow-Origin": "*",
                                "Content-Type": "text/html"
                            });
                            response.end(resp);
                        }
                    });
                }
            return;

            case "embed":
                if (url.query.id && !url.query.accept) {
                    fs.readFile(__dirname + "/web/dynamic/embed/index.html", function(err, resp) {
                        if (err) {
                            handleError(request, response, err);
                        } else {
                            var $ = cheerio.load(resp);
                            $(".mainImg img").attr("src", "/proxy?url=" + btoa("https://i.ytimg.com/vi/" + url.query.id + "/hqdefault.jpg"));
                            $("#ph").attr("href", "/embed?id=" + url.query.id + "&accept=true");
                            $("#nt").attr("href", "https://youtube.com/watch?v=" + url.query.id);
                            response.writeHead(200, {
                                "Accept-Control-Allow-Origin": "*",
                                "Content-Type": "text/html"
                            });
                            response.end($.html());
                        }
                    })
                } else if (url.query.id && url.query.accept == "true") {
                    response.writeHead(302, {
                        "Access-Control-Allow-Origin": "*",
                        "Location": "https://www.youtube-nocookie.com/embed/" + url.query.id,
                        "Content-Type": "text/plain"
                    });
                    response.end("Please wait...");
                } else {
                    fs.readFile(__dirname + "/web/dynamic/error/404.html", function(err, resp) {
                        if (err) {
                            handleError(request, response, err);
                        } else {
                            response.writeHead(404, {
                                "Access-Control-Allow-Origin": "*",
                                "Content-Type": "text/html"
                            });
                            response.end(resp);
                        }
                    });
                }
            return;

            case "proxy":
                if (url.query.url) {
                    var pUrl = atob(url.query.url);
                    if (!pUrl.startsWith("http://") && !pUrl.startsWith("https://")) { pUrl = "http://" + pUrl; }
                    if (pUrl.substring(pUrl.length - 3, pUrl.length) == "svg" && url.query.favicon) {
                        response.writeHead(302, {
                            "Access-Control-Allow-Origin": "*",
                            "Location": "/globe.png"
                        });
                        response.end();
                        return;
                    }
                    var pUrlp = parse(pUrl, true);
                    if (url.query.favicon) {
                        var hdr = {
                            "Accept-Encoding": "gzip,deflate,br",
                            "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
                            "From": "googlebot(at)googlebot.com",
                            "Accept": "text/html,application/xhtml,application/xml;q=0.9,*/*,q=0.8",
                            "Connection": "close",
                            "Cache-Control": "no-cache",
                            "Accept-Language": "en-US"
                        };
                    } else {
                        var hdr = {
                            "Host": pUrlp.host,
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:85.0) Gecko/20100101 Firefox/85.0",
                            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                            "Accept-Language": "en-US,en;q=0.5",
                            "Accept-Encoding": "gzip, deflate, br",
                            "DNT": "1",
                            "Connection": "keep-alive",
                            "Upgrade-Insecure-Requests": "1",
                            "Sec-GPC": "1"
                        };
                    }
                    got(pUrl, {
                        headers: hdr
                    }).then(function(r) {
                        if (url.query.favicon) {
                            if (
                                !r.headers["content-type"].startsWith("image/") && 
                                r.headers["content-type"] !== "image/svg+xml" && 
                                r.headers["content-type"] !== "image/svg"
                            ) {
                                response.writeHead(302, {
                                    "Access-Control-Allow-Origin": "*",
                                    "Location": "/globe.png"
                                });
                                response.end();
                                return;
                            }
                        }
                        response.end(r.rawBody);
                    }).catch(function(e) {
                        if (e.response && e.response.body) {
                            response.end(e.response.rawBody);
                        } else {
                            response.end(e.stack);
                        }
                    })
                } else {
                    fs.readFile(__dirname + "/web/dynamic/error/404.html", function(err, resp) {
                        if (err) {
                            handleError(request, response, err);
                        } else {
                            response.writeHead(404, {
                                "Access-Control-Allow-Origin": "*",
                                "Content-Type": "text/html"
                            });
                            response.end(resp);
                        }
                    })
                }
            return;

            case "favicon":
                if (url.query.link) {
                    fv.isIco(atob(url.query.link), function(err, resp) {
                        if (resp !== true) {
                            response.writeHead(302, {
                                "Access-Control-Allow-Origin": "*",
                                "Location": "/globe.png"
                            });
                            response.end();
                        } else {
                            response.writeHead(302, {
                                "Access-Control-Allow-Origin": "*",
                                "Location": "/proxy?url=" + btoa("http://" + parse(atob(url.query.link)).host + "/favicon.ico") + "&favicon=true"
                            })
                            response.end();
                        }
                    });
                } else {
                    response.writeHead(302, {
                        "Access-Control-Allow-Origin": "*",
                        "Location": "/globe.png"
                    })
                    response.end();
                }
            return;

            case "suggest":
                if (url.query.q) {
                    bing.suggest(url.query.q, function(err, resp) {
                        if (err) {
                            response.writeHead(400, {
                                "Access-Control-Allow-Origin": "*",
                                "Content-Type": "application/x-suggestions+json"
                            });
                            response.end(JSON.stringify([]));
                        } else {
                            response.writeHead(200, {
                                "Access-Control-Allow-Origin": "*",
                                "Content-Type": "application/x-suggestions+json"
                            });
                            response.end(JSON.stringify([url.query.q, resp]));
                        }
                    })
                } else {
                    response.writeHead(400, {
                        "Access-Control-Allow-Origin": "*",
                        "Content-Type": "application/x-suggestions+json"
                    });
                    response.end(JSON.stringify([]));
                }
            return;

            case "dict":
                if (url.query.w) {
                    fs.readFile(__dirname + "/web/dynamic/dict/index.html", function(err, resp) {
                        if (err) {
                            handleError(request, response, err);
                        } else {
                            var $ = cheerio.load(resp);
                            if (url.query.w.includes("definition") || !url.query.w.includes("definition of")) {var q = url.query.w.split("definition").join("");}
                            else if (url.query.w.includes("definition of")) {var q = url.query.w.split("definition of").join("");}
                            else if (url.query.w.includes("meaning") || !url.query.w.includes("meaning of")) {var q = url.query.w.split("meaning").join("");}
                            else if (url.query.w.includes("meaning of")) {var q = url.query.w.split("meaning of").join("");}
                            if (!q) {var q = url.query.q;} else {q.split(" ").join("");}
                            lex.search(q).then(function(res) {
                                $(".word").text(q);
                                $(".pos").text(res.pos);
                                for (var c in res.meanings) {
                                    var m = `<li>${res.meanings[c].value} `;
                                    if (res.meanings[c].type !== "n/a") {m = m + "(<b class='typeMeaning'>" + res.meanings[c].type + "</b>)</li>"} else {m = m +"</li>"}
                                    $("#defs").append(m);
                                }
                                $(".origin").text(res.origin);
                                $(".site").attr("href", res.url);
                                response.writeHead(200, {
                                    "Access-Control-Allow-Origin": "*",
                                    "Content-Type": "text/html"
                                })
                                response.end($.html());
                            }).catch(function(err) {
                                if (err.message == "Request failed with status code 404") {
                                    fs.readFile(__dirname + "/web/dynamic/dict/nores.html", function(err, resp) {
                                        if (err) {
                                            handleError(request, response, err);
                                        } else {
                                            response.writeHead(404, {
                                                "Access-Control-Allow-Origin": "*",
                                                "Content-Type": "text/html"
                                            })
                                            response.end(resp);
                                        }
                                    })
                                } else {
                                    handleError(request, response, err);
                                }
                            })
                        }
                    })
                } else {
                    fs.readFile(__dirname + "/web/dynamic/error/404.html", function(err, resp) {
                        if (err) {
                            handleError(request, response, err);
                        } else {
                            response.writeHead(404, {
                                "Access-Control-Allow-Origin": "*",
                                "Content-Type": "text/html"
                            });
                            response.end(resp);
                        }
                    });
                }
            return;

            case "weather":
                if (!url.query.location && !url.query.q) {
                    fs.readFile(__dirname + "/web/dynamic/weather/index.html", function(err, resp) {
                        if (err) {
                            handleError(request, response, err);
                        } else {
                            response.writeHead(200, {
                                "Access-Control-Allow-Origin": "*",
                                "Content-Type": "text/html"
                            });
                            response.end(resp);
                        }
                    });
                } else if (url.query.q && !url.query.location) {
                    lw.search(encodeURIComponent(url.query.q), function(err, w) {
                        if (err) {
                            if (err.code == "oneResult") {
                                response.writeHead(302, {
                                    "Access-Control-Allow-Origin": "*",
                                    "Location": "/weather/?location=" + btoa(err.url) 
                                });
                                response.end();
                                return;
                            }
                            handleError(request, response, err);
                        } else {
                            fs.readFile(__dirname + "/web/dynamic/weather/search.html", function(err, resp) {
                                if (err) {
                                    handleError(request, response, err);
                                } else {
                                    var $ = cheerio.load(resp);
                                    for (var c in w) {
                                        var d = `<a href='/weather/?location=${btoa(w[c].href)}'><div class='loc'><h3>${w[c].location}</h3></div></a>`;
                                        $(".results").append(d);
                                    }
                                    response.writeHead(200, {
                                        "Access-Control-Allow-Origin": "*",
                                        "Content-Type": "text/html"
                                    })
                                    response.end($.html());
                                }
                            });
                        }
                    });
                } else if (url.query.location) {
                    lw.get(atob(url.query.location), function(err, w) {
                        if (err) {
                            handleError(request, response, err);
                        } else {
                            fs.readFile(__dirname + "/web/dynamic/weather/location.html", function(err, resp) {
                                if (err) {
                                    handleError(request, response, err);
                                } else {
                                    var $ = cheerio.load(resp);
                                    if (w.current.radarData) {
                                        $(".bg img").attr("src", "/proxy/?url=" + btoa(w.current.radarData));
                                    } else {
                                        $(".bg").remove();
                                    }
                                    $(".location").text(w.location);
                                    $(".temp").text(w.current.temp);
                                    $(".high").text(w.current.highTemp);
                                    $(".low").text(w.current.lowTemp);
                                    $(".mes").text(w.mesaurement);
                                    $(".ws").text(w.current.windSpeed);
                                    $(".sr").text(w.current.sunrise);
                                    $(".se").text(w.current.sunset);
                                    $(".hu").text(w.current.humidity);
                                    $(".vi").text(w.current.visibility);
                                    $(".currDesc").text(w.current.description.toLowerCase());
                                    response.writeHead(200, {
                                        "Access-Control-Allow-Origin": "*",
                                        "Content-Type": "text/html"
                                    })
                                    response.end($.html());
                                }
                            })
                        }
                    });
                } else {
                    fs.readFile(__dirname + "/web/dynamic/error/404.html", function(err, resp) {
                        if (err) {
                            handleError(request, response, err);
                        } else {
                            response.writeHead(404, {
                                "Access-Control-Allow-Origin": "*",
                                "Content-Type": "text/html"
                            });
                            response.end(resp);
                        }
                    });
                }
            return;

            default:
                fs.readFile(__dirname + "/web/dynamic/error/404.html", function(err, resp) {
                    if (err) {
                        handleError(request, response, err);
                    } else {
                        response.writeHead(404, {
                            "Access-Control-Allow-Origin": "*",
                            "Content-Type": "text/html"
                        });
                        response.end(resp);
                    }
                });
            return;
        }
    }
}

function contentType(file) {
    switch (file.split(".")[file.split(".").length - 1]) {
        case "html":
            return "text/html";
        case "css":
            return "text/css";
        case "json":
            return "application/json";
        case "js":
            return "application/javascript";
        case "jpg":
            return "image/jpeg";
        case "png":
            return "image/png";
        case "gif":
            return "images/gif";
        case "svg":
            return "image/svg+xml";
        case "xml":
            return "application/xml";
        case "osxml":
            return "application/opensearchdescription+xml";
        case "json":
            return "application/json";
        default:
            return "text/plain";
    }
}

function handleError(request, response, error) {
    if (typeof error == "object" || typeof error == "string") {
        if (error.stack !== undefined) {var errTxt = error.stack;}
        else if (error.message !== undefined) {var errTxt = error.message;}
        else if (error.code !== undefined) {var errTxt = error.code;}
        else {var errTxt = error;}
        fs.readFile(__dirname + "/web/dynamic/error/index.html", function(err, resp) {
            if (err) {
                response.writeHead(500, {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "text/plain"
                });
                response.end(errTxt);
            } else {
                var $ = cheerio.load(resp);
                $("#err").text(errTxt);
                response.writeHead(500, {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "text/html"
                });
                response.end($.html());
            }
        });
    } else {
        fs.readFile(__dirname + "/web/dynamic/error/unknown.html", function(err, resp) {
            if (err) {
                response.writeHead(500, {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "text/plain"
                });
                response.end(errTxt);
            } else {
                response.writeHead(500, {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "text/plain"
                });
                response.end(resp);
            }
        });
    }
}

function btoa(string) {
    return Buffer.from(string, "utf-8").toString("base64");
}

function atob(string) {
    return Buffer.from(string, "base64").toString("utf-8");
}

function mkLnk(t) {
    var replacePattern = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
	return t.replace(replacePattern, '<a href="$1">$1</a>');
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }