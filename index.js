const http = require("http");
const fs = require("fs");
const got = require("got");
const cheerio = require("cheerio");
const bing = require("bing-scraper");
const { parse } = require("url");
const port = process.env.PORT || 7070

http.createServer(requestListener).listen(port);
console.log("Server is listening on port " + port);

function requestListener(request, response) {
    var url = parse(request.url, true);
    if (fs.existsSync(__dirname + "/web/static" + url.path + "index.html")) {
        console.log("index")
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
                bing.search({
                    q: url.query.q,
                    pageCount: 2,
                    lang: l,
                    enforceLanguage: true 
                }, function(err, results) {
                    if (err) {
                        handleError(request, response, err);
                    } else {
                        fs.readFile(__dirname + "/web/dynamic/search/index.html", function(err, resp) {
                            if (err) {
                                handleError(request, response, err);
                            } else {
                                var $ = cheerio.load(resp);
                                $("title").text(url.query.q + " on Wallaby");
                                for (var c in results) {
                                    var chip = "<a class='resLink' href='" + results[c].url + "'><div class='result'><h2>" + results[c].title + "</h2><h4>" + results[c].url + "</h4><p>" + results[c].description + "</p></div></a>";
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
            }
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