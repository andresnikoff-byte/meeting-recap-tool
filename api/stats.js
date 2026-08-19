function last7Days() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          days.push(d.toISOString().slice(0, 10));
    }
    return days;
}

module.exports = async (req, res) => {
    const key = (req.query && req.query.key) || "";
    if (!key || key !== process.env.STATS_SECRET) {
          res.status(401).json({ error: "Unauthorized" });
          return;
    }

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
          res.status(500).json({ error: "Counter storage not configured" });
          return;
    }

    const days = last7Days();

    try {
          const totalRes = await fetch(`${url}/get/total_recaps`, {
                  headers: { Authorization: `Bearer ${token}` },
          });
          const totalData = await totalRes.json();
          const total = totalData && totalData.result ? parseInt(totalData.result, 10) : 0;

      const daily = {};
          for (const day of days) {
                  const r = await fetch(`${url}/get/recaps:${day}`, {
                            headers: { Authorization: `Bearer ${token}` },
                  });
                  const d = await r.json();
                  daily[day] = d && d.result ? parseInt(d.result, 10) : 0;
          }

      const last7DaysTotal = Object.values(daily).reduce((a, b) => a + b, 0);

      res.status(200).json({
              totalAllTime: total,
              last7Days: daily,
              last7DaysTotal,
              generatedAt: new Date().toISOString(),
      });
    } catch (err) {
          res.status(500).json({ error: "Failed to read stats" });
    }
};
