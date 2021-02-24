const http = require("http");
const fs = require("fs");
const { parse } = require("url");
const got = require("got");
const cheerio = require("cheerio");
const bing = require("bing-scraper");
const faviconUrl = require("favicon-url");
const port = process.env.PORT || 7070

http.createServer(requestListener).listen(port);
console.log("Server is listening on port " + port);

async function requestListener(request, response) {
    var url = parse(request.url, true);
    if (fs.existsSync(__dirname + "/web/static" + url.path + "index.html")) {
        fs.readFile(__dirname + "/web/static" + url.path + "index.html", function (err, resp) {
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
    } else if (fs.existsSync(__dirname + "/web/static" + url.path)) {
        fs.readFile(__dirname + "/web/static" + url.path, function (err, resp) {
            if (err) {
                handleError(request, response, err);
            } else {
                response.writeHead(200, {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": contentType(url.path)
                });
                response.end(resp);
            }
        });
    } else {
        var pathClean = url.pathname.split("/").slice(1);
        var path = url.pathname;
        if (pathClean[0] == "search") {
            if (url.query.q) {
                if (request.headers["accept-language"]) {var l = request.headers["accept-language"];}
                else if (request.headers["Accept-Language"]) {var l = request.headers["Accept-Language"];}
                else {var l = "en-US,en;q=0.5";}

                if (url.query.scrape) {
                    var scrapeUrl = atob(url.query.scrape);
                    var object = {
                        url: scrapeUrl,
                        pageCount: 3,
                        lang: l
                    }
                } else {
                    var object =  {
                        q: url.query.q,
                        pageCount: 3,
                        lang: l
                    }
                }
                bing.search(object, function(err, res) {
                    if (err) {
                        handleError(request, response, err);
                    } else {
                        fs.readFile(__dirname + "/web/dynamic/search/index.html", function(err, resp) {
                            if (err) {
                                handleError(request, response, err);
                            } else {
                                var $ = cheerio.load(resp);
                                $('#searchBox').val(url.query.q)
                                $("title").text("Results for \"" + url.query.q + "\" on Seekly");

                                // main result adding
                                if (res.qnaAnswer !== null && res.qnaAnswer.answer !== "") {
                                    var bChip = "<div class='qnaResult result'><p>" + res.qnaAnswer.answer + "</p><a class='resLink' href='" + res.qnaAnswer.source.url + "'><h2>" + res.qnaAnswer.source.title + "</h2><h4>" + res.qnaAnswer.source.url + "</h4></a></div>";
                                    $(".main").append(bChip);
                                } else if (res.topAnswer !== null) {
                                    if (res.topAnswer.image !== null) {
                                        var bChip = "<div class='topResult result'><img src='/proxy?url=" + btoa(res.topAnswer.image) + "'><div><h4>" + res.topAnswer.title + "</h4><h2>" + res.topAnswer.answer + "</h2><div></div>"
                                    } else {
                                        var bChip = "<div class='topResult result'><h4>" + res.topAnswer.title + "</h4><h2>" + res.topAnswer.answer + "</h2></div>"
                                    }
                                    $(".main").append(bChip);
                                }

                                // prev/next buttons
                                if (res.nextHref !== null) {
                                    $("#more").attr("href",  "/search?q=" + url.query.q + "&scrape=" + btoa(res.nextHref));
                                } else {
                                    $("#more").remove();
                                }

                                if (res.prevHref !== null && url.query.scrape) {
                                    $("#prev").attr("href",  "/search?q=" + url.query.q + "&scrape=" + btoa(res.prevHref));
                                } else {
                                    $("#prev").remove();
                                }

                                // web result adding
                                for (var c in res.results) {
                                    var chip = "<a class='resLink' href='" + res.results[c].url + "'><div class='result'><h2>" + res.results[c].title + "</h2><div class='urlCont'><img class='favicon' src='/favicon/?link=" + btoa(res.results[c].url) + "'><h4>" + res.results[c].url + "</h4></div><p>" + res.results[c].description + "</p></div></a>";
                                    $(".main").append(chip);
                                }

                                response.writeHead(200, {
                                    "Accept-Control-Allow-Origin": "*",
                                    "Content-Type": "text/html"
                                });
                                response.end($.html());
                            }
                        })
                    }
                })
            } else {
                response.writeHead(302, {
                    "Access-Control-Allow-Origin": "*",
                    "Location": "/"
                })
                response.end();
            }
        } else if (pathClean[0] == "proxy") {
            if (url.query.url) {
                var pUrl = atob(url.query.url);
                var pUrlp = parse(pUrl, true);
                try {
                    got(pUrl, {
                        headers: {
                            "Host": pUrlp.host,
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:85.0) Gecko/20100101 Firefox/85.0",
                            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                            "Accept-Language": "en-US,en;q=0.5",
                            "Accept-Encoding": "gzip, deflate, br",
                            "DNT": "1",
                            "Connection": "keep-alive",
                            "Upgrade-Insecure-Requests": "1",
                            "Sec-GPC": "1"
                        }
                    }).then(function(r) {
                        response.end(r.rawBody);
                    })
                } catch(error) {
                    handleError(request, response, error);
                }
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
        } else if (pathClean[0] == "favicon") {
            if (url.query.link) {
                var host = parse(atob(url.query.link), true).host;
                faviconUrl(host, {timeout: 2000}, function(favicon) {
                    if (favicon !== null) {
                        response.writeHead(302, {
                            "Access-Control-Allow-Origin": "*",
                            "Location": "/proxy/?url=" + btoa(favicon)
                        })
                        response.end();
                    } else {
                        response.writeHead(302, {
                            "Access-Control-Allow-Origin": "*",
                            "Location": "/globe.png"
                        })
                        response.end();
                    }
                })
            } else {
                response.writeHead(302, {
                    "Access-Control-Allow-Origin": "*",
                    "Location": "/globe.png"
                })
                response.end();
            }
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
                console.log("there was an error reading the error html");
                console.log(err);
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
                console.log("there was an error reading the error html");
                console.log(err);
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
