const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const exphbs = require("express-handlebars");
const Handlebars = require("handlebars");
const logger = require("morgan");
// Scraping tools
const axios = require("axios");
const cheerio = require("cheerio");

const { allowInsecurePrototypeAccess } = require('@handlebars/allow-prototype-access');

// Require all models
let db = require("./models");

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/mongoHeadlines";

// Initialize Express
let app = express();
app.use(logger("dev"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({
    type: "application/json"
}));
// Make public a static folder
app.use(express.static(__dirname + "/public"));

// Connect to Mongo DB
mongoose.Promise = Promise;
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true }, function (err) {
    if (err) {
        console.log(err);
    } else {
        console.log("Mongoose connection is successful.");
    }
});


// Connect Handlebars to express
app.engine("handlebars", exphbs({ defaultLayout: "main", handlebars: allowInsecurePrototypeAccess(Handlebars) }));
app.set("view engine", "handlebars");

// Get articles from the db
app.get("/", function (req, res) {
    db.Article.find({
        saved: false
    },
        function (err, dbArticle) {
            if (err) {
                console.log(err);
            } else {
                res.render("home", {
                    articles: dbArticle
                });
            }
        })
})

// Get route for scraping the website
app.get("/scrape", function (req, res) {
    axios.get("https://techcrunch.com/").then(function (response) {
        let $ = cheerio.load(response.data);
        $("article.post-block").each(function (i, element) {
            let title = $(element).find("a.post-block__title__link").text().trim();
            let url = $(element).find("a.post-block__title__link").attr("href");
            let description = $(element).children(".post-block__content").text().trim();

            if (title && url && description) {
                db.Article.create({
                    title: title,
                    url: url,
                    description: description
                }).then(function (dbArticle) {
                    console.log(dbArticle);
                }).catch(function (err) {
                    console.log(err);
                })
            }
        })
        res.send("Scrape Complete")
    })
});

// Get route for saved articles
app.get("/saved", function (req, res) {
    db.Article.find({
        saved: true
    }).then(function (dbArticle) {
        res.render("saved", {
            articles: dbArticle
        })
    }).catch(function (err) {
        res.json(err);
    })
});

app.put("/saved/:id", function (req, res) {
    db.Article.findByIdAndUpdate(
        req.params.id, {
        $set: req.body
    }, {
        new: true
    }).then(function (dbArticle) {
        res.render("saved", {
            articles: dbArticle
        })
    }).catch(function (err) {
        res.json(err);
    });
});

app.post("/submit/:id", function (req, res) {
    db.Comment.create(req.body).then(function (dbComment) {
        let articleId = mongoose.Types.ObjectId(req.params.id);
        return db.Article.findByIdAndUpdate(articleId, {
            $push: {
                comments: dbComment._id
            }
        })
    }).then(function (dbArticle) {
        res.json(dbComment);
    }).catch(function (err) {
        res.json(err);
    })
});

app.get("/comments/article/:id", function (req, res) {
    db.Article.findOne({ "_id": req.params.id }).populate("comments").then(function (dbArticle) {
        res.json(dbArticle);
    })
});



app.listen(PORT, function () {
    console.log("App running on port " + PORT + "!");
});