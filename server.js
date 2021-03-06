const express = require("express");
const cluster = require("cluster");
const path = require("path");
const bodyParser = require("body-parser");
const compression = require("compression");
const session = require("express-session");
// Login
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
// This value is never used, but only for the uniformity.
const passportConfig = require("./config/passport")(passport, LocalStrategy);
// Mysql, Redis
const db = require("mysql");
const dbConfig = require("./config/dbConfig.json");
const redis = require("redis");
const RedisStore = require("connect-redis")(session);
// Utils
const moment = require("moment");
const util = require("util");
// Custom config
const teamInfo = require("./config/teamConfig.json");
const platInfo = require("./config/platformConfig.json");

const serverPortNo = 8000;
const coreNo = 2;
const redisClient = redis.createClient();

function handleDisconnect() {
    const pool = db.createPool(dbConfig);

    pool.on("connection", err => {
        const now = moment().format("YYYY.MM.DD HH:mm:ss");

        if (err) {
            console.log(`Connecting... : ${now}`);
            setTimeout(handleDisconnect, 3000);
        }
    });

    pool.on("error", err => {
        const now = moment().format("YYYY.MM.DD HH:mm:ss");

        if (err.code === "PROTOCOL_CONNECTION_LOST") {
            console.log(`Connection Lost : ${now}`);
            handleDisconnect();
        } else {
            throw err;
        }
    });

    return pool;
}

if (cluster.isMaster) {
    console.log(`Master started(PID : ${process.pid})`);
    for (let i = 0; i < coreNo; i++) {
        const worker = cluster.fork();

        console.log(`Worker started(PID : ${worker.process.pid})`);
    }

    redisClient.on("error", err => {
        console.error(`Redis error : ${err}`);
    });
    redisClient.set("abmaxLabel", "20");
    redisClient.set("maxLabel", "5");

    cluster.on("exit", (worker, code, signal) => {
        const newworker = cluster.fork();

        console.log(`Worker died(PID : ${worker.process.pid}) -> Worker started(PID : ${newworker.process.pid})`);
    });
} else {
    const app = express();
    const pool = handleDisconnect();
    const asyncQuery = util.promisify(pool.query).bind(pool);

    app.use(compression());
    app.set("views", path.join(__dirname, "/views"));
    app.use("/scripts", express.static(path.join(__dirname, "/node_modules")));
    app.use(express.static(path.join(__dirname, "/public")));
    app.set("view engine", "ejs");
    app.engine("html", require("ejs").renderFile);

    // middlewares
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
        extended: true,
    }));
    app.use(session({
        secret: "!@#nts#@!",
        resave: false,
        saveUninitialized: false,
        store: new RedisStore({
            client: redisClient,
            logErrors: true,
        }),
        cookie: {
            maxAge: 30 * 60 * 1000, // 30 min
        },
    }));

    // passport
    app.use(passport.initialize());
    app.use(passport.session());

    // routes
    app.use("/auto", require("./routes/route.js")(asyncQuery, teamInfo));
    app.use("/getData", require("./routes/getData.js")(asyncQuery, redisClient, teamInfo, platInfo));
    app.use("/access", require("./routes/accessDB.js")(asyncQuery, redisClient, teamInfo, platInfo));
    app.use("/admin", require("./routes/admin.js")(passport, redisClient));
    // Else -> 404 Page
    app.use((req, res, next) => {
        res.statusCode = 404;
        next(new Error(`${req.url} NOT FOUND`));
    });
    // Error handler
    app.use((err, req, res, next) => {
        const now = moment().format("YYYY.MM.DD HH:mm:ss");

        if (err.statusCode === 400 || res.statusCode === 400 || err.code === "ER_DATA_TOO_LONG") {
            res.status(400).json({
                "error": "Bad Request - Please Check your input values",
            });
        } else if (res.statusCode === 404) {
            res.status(404).render("page_404");
        } else {
            res.statusCode = 500;
            res.status(500).render("page_500");
        }

        console.error(`---\n${res.statusCode} Error occured : ${now}`);
        console.error(err);
    });

    const server = app.listen(serverPortNo, () => {
        const now = moment().format("YYYY.MM.DD HH:mm:ss");

        console.log(`Server Start : ${now}`);
    });
}
