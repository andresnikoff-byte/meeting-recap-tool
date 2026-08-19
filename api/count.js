module.exports = async (req, res) => {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
          res.status(200).json({ total: null });
          return;
    }

    try {
          const r = await fetch(`${url}/get/total_recaps`, {
                  headers: { Authorization: `Bearer ${token}` },
          });
          const data = await r.json();
          const total = data && data.result ? parseInt(data.result, 10) : 0;
          res.status(200).json({ total });
    } catch {
          res.status(200).json({ total: null });
    }
};
