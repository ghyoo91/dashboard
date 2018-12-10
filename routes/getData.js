module.exports = function(app, pool, maxLabel, teamConfig) {
  const express = require("express");
  const router = express.Router();

  router.get("/getPlatformChartData", (req, res) => {
    pool.query("select pj_id from project", (err, rows) => {
      const now = new Date();

      if (err) {
        console.error("---Error : /index " + err.code + "\n---Error Time : " + now);
        res.redirect("/500");
      } else {
        res.status(200).json({"success": 1});
      }
    });
  });

  router.get("/getChartData/:page/:detail?", (req, res) => {
    let queryText = "select b.pj_id, b.build_id, b.buildno, sum(ifnull(m.pass, 0)) pass, sum(ifnull(m.fail, 0)) fail, sum(ifnull(m.skip, 0)) skip, min(ifnull(m.start_t, 0)) start_t, sec_to_time(sum(ifnull(m.duration, 0))) duration from (select pj_id, build_id, buildno, @rn := IF(@prev = pj_id, @rn + 1, 1) AS rn, @prev := pj_id FROM buildno inner join (select @prev := NULL, @rn := 0) as vars order by pj_id, build_id DESC, buildno DESC) b left join ( select pj_id, build_id, class_id, count(Case when result = 1 then 1 end) pass, count(Case when result = 2 then 1 end) fail,  count(Case when result = 3 then 1 end) skip, Date_format(min(start_t), '%Y/%m/%d %H:%i:%s') start_t,  unix_timestamp(max(end_t)) - unix_timestamp(min(start_t)) as duration from method group by pj_id, build_id, class_id) m on b.build_id = m.build_id inner join project pj on pj.pj_id = b.pj_id where b.rn <=" + maxLabel.getMaxLabel();
    let queryTextLabel = "";
    const result = {};

    // All page data
    if (req.params.page === "all") {
      queryTextLabel = "select pj_name, pj_id, pj_link from project;";
    } else if (req.params.page === "team") {
      let teamname = teamConfig.name[req.params.detail];

      queryText = queryText + " and pj.pj_team = '" + teamname + "'";
      queryTextLabel = "select pj_name, pj_id, pj_link from project where pj_team = '" + teamname + "';";
    } else if (req.params.page === "platform") {
      queryText = queryText + " and pj.pj_platform = '" + req.params.detail + "'";
      queryTextLabel = "select pj_name, pj_id, pj_link from project where pj_platform = '" + req.params.detail + "';";
    } else {
      queryText = "";
    }
    queryText += " group by pj_id, build_id;";

    pool.query(queryText, (err, rows) => {
      const now = new Date();

      if (err) {
        console.error("---Error : /getChartData " + err.code + "\n---Error Time : " + now + "\n---Error query : " + queryText);
        res.redirect("/500");
      } else {
        result.data = rows;
        pool.query(queryTextLabel, (innererr, innerrows) => {
          if (innererr) {
            console.error("---Error : /getChartData " + innererr.code + "\n---Error Time : " + now + "\n---Error query : " + queryTextLabel);
            res.redirect("/500");
          } else {
            result.pj_label = innerrows;
            result.totalChartCount = innerrows.length;
            result.maxLabel = maxLabel.getMaxLabel();
            res.status(200).json(result);
          }
        });
      }
    });
  });

  router.get("/getCustomData/:category/:previousValue?", (req, res) => {
    let queryText = "";

    if (req.params.category === "project") {
      queryText = "select pj_id, pj_name, pj_team from project";
    } else if (req.params.category === "buildno") {
      queryText = "select build_id, buildno from buildno where pj_id = " + req.params.previousValue + ";";
    } else if (req.params.category === "class") {
      queryText = "select class_id, package_name, class_name from class where build_id = " + req.params.previousValue + ";";
    } else if (req.params.category === "testcase") {
      queryText = "select method_id, method_name from method where class_id = " + req.params.previousValue + ";";
    } else {
      queryText = "";
    }

    pool.query(queryText, (err, rows) => {
      const now = new Date();

      if (err) {
        console.error("---Error : /getCustomData " + err.code + "\n---Error Time : " + now + "\n---Error query : " + queryText);
        res.redirect("/500");
      } else {
        res.status(200).json(rows);
      }
    });
  });

  router.get("/getInitialModalData/:pj_id", (req, res) => {
    let queryText = "select b.pj_id, b.build_id, b.buildno, sum(ifnull(m.pass, 0)) pass, sum(ifnull(m.fail, 0)) fail, sum(ifnull(m.skip, 0)) skip, min(ifnull(m.start_t, 0)) start_t, sec_to_time(sum(ifnull(m.duration, 0))) duration from (select pj_id, build_id, buildno, @rn := IF(@prev = pj_id, @rn + 1, 1) AS rn, @prev := pj_id FROM buildno inner join (select @prev := NULL, @rn := 0) as vars order by pj_id, build_id DESC, buildno DESC) b left join ( select pj_id, build_id, class_id, count(Case when result = 1 then 1 end) pass, count(Case when result = 2 then 1 end) fail,  count(Case when result = 3 then 1 end) skip, Date_format(min(start_t), '%Y/%m/%d %H:%i:%s') start_t,  unix_timestamp(max(end_t)) - unix_timestamp(min(start_t)) as duration from method group by pj_id, build_id, class_id) m on b.build_id = m.build_id inner join project pj on pj.pj_id = b.pj_id where b.rn <= " + maxLabel.getAbsoluteMaxLabel() + " and pj.pj_id = " + req.params.pj_id + " group by pj_id, build_id;";
    let queryTextLabel = "select pj_name, pj_team, pj_platform, pj_author, pj_id, pj_link from project where pj_id = '" + req.params.pj_id + "';";
    const result = {};

    pool.query(queryText, (err, rows) => {
      const now = new Date();

      if (err) {
        console.error("---Error : /getModalData " + err.code + "\n---Error Time : " + now + "\n---Error query : " + queryText);
        res.redirect("/500");
      } else {
        result.data = rows;
        pool.query(queryTextLabel, (innererr, innerrows) => {
          if (innererr) {
            console.error("---Error : /getModalData " + innererr.code + "\n---Error Time : " + now + "\n---Error query : " + queryTextLabel);
            res.redirect("/500");
          } else {
            result.pj_label = innerrows;
            result.totalChartCount = innerrows.length;
            result.maxLabel = maxLabel.getAbsoluteMaxLabel();
            res.status(200).json(result);
          }
        });
      }
    });
  });

  router.get("/getModalDataDetail/:pj_id/:build_id", (req, res) => {
    let queryText = "select c.class_id, c.class_name, c.package_name, m.pass, m.fail, m.skip, m.start_t from class c inner join (select pj_id, build_id, class_id, count(Case when result = 1 then 1 end) pass, count(Case when result = 2 then 1 end) fail, count(Case when result = 3 then 1 end) skip, Date_format(min(start_t), '%Y/%m/%d %H:%i:%s') start_t, unix_timestamp(max(end_t)) - unix_timestamp(min(start_t)) as duration from method group by pj_id, build_id, class_id) m on m.class_id=c.class_id where c.pj_id=" + req.params.pj_id + " and c.build_id=" + req.params.build_id + ";";
    const result = {};

    pool.query(queryText, (err, rows) => {
      const now = new Date();

      if (err) {
        console.error("---Error : /getModalDataDetail " + err.code + "\n---Error Time : " + now + "\n---Error query : " + queryText);
        res.redirect("/500");
      } else {
        result.data = rows;
        result.classcount = rows.length;
        res.status(200).json(result);
      }
    });
  });

  return router;
};