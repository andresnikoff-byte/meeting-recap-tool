(function () {
  const transcriptEl = document.getElementById("transcript");
  const charCountEl = document.getElementById("charCount");
  const generateBtn = document.getElementById("generateBtn");
  const errorBox = document.getElementById("errorBox");
  const resultCard = document.getElementById("resultCard");
  const summaryText = document.getElementById("summaryText");
  const actionItemsBox = document.getElementById("actionItemsBox");
  const topicsSection = document.getElementById("topicsSection");
  const topicsText = document.getElementById("topicsText");
  const copyLinkBtn = document.getElementById("copyLinkBtn");
  const copyTextBtn = document.getElementById("copyTextBtn");
  const footerNote = document.getElementById("footerNote");

  let lastResult = null;

  function updateCharCount() {
    charCountEl.textContent = transcriptEl.value.length.toLocaleString();
  }
  transcriptEl.addEventListener("input", updateCharCount);
  updateCharCount();

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = "block";
  }
  function clearError() {
    errorBox.style.display = "none";
    errorBox.textContent = "";
  }

  function renderResult(result) {
    lastResult = result;
    summaryText.textContent = result.summary || "";

    actionItemsBox.innerHTML = "";
    if (!result.actionItems || result.actionItems.length === 0) {
      const p = document.createElement("p");
      p.style.color = "var(--text-dim)";
      p.textContent = "No clear action items found in this transcript.";
      actionItemsBox.appendChild(p);
    } else {
      result.actionItems.forEach((item) => {
        const row = document.createElement("div");
        row.className = "action-item";

        const owner = document.createElement("span");
        owner.className = "owner";
        owner.textContent = item.owner || "Unassigned";

        const task = document.createElement("span");
        task.textContent = item.task || "";

        row.appendChild(owner);
        row.appendChild(task);
        actionItemsBox.appendChild(row);
      });
    }

    if (result.topics && result.topics.length > 0) {
      topicsSection.style.display = "block";
      topicsText.textContent = result.topics.join(" · ");
    } else {
      topicsSection.style.display = "none";
    }

    resultCard.style.display = "block";
  }

  async function handleGenerate() {
    clearError();
    resultCard.style.display = "none";

    const transcript = transcriptEl.value.trim();
    if (transcript.length < 40) {
      showError("Paste more of the conversation — that looks too short.");
      return;
    }

    generateBtn.disabled = true;
    generateBtn.innerHTML = '<span class="spinner"></span>Generating recap...';

    try {
      const res = await fetch("/api/recap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();

      if (!res.ok) {
        showError(data.error || "Something went wrong.");
      } else {
        renderResult(data);
        refreshCount(true);
      }
    } catch (err) {
      showError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = "Generate recap";
    }
  }

  function encodeResult(result) {
    const json = JSON.stringify(result);
    return btoa(unescape(encodeURIComponent(json)));
  }

  function handleCopyLink() {
    if (!lastResult) return;
    const hash = encodeResult(lastResult);
    const link = `${window.location.origin}/r.html#${hash}`;
    navigator.clipboard.writeText(link).then(() => {
      const original = copyLinkBtn.textContent;
      copyLinkBtn.textContent = "Link copied!";
      setTimeout(() => (copyLinkBtn.textContent = original), 2000);
    });
  }

  function handleCopyText() {
    if (!lastResult) return;
    const lines = [
      "Summary:",
      lastResult.summary || "",
      "",
      "Action items:",
      ...(lastResult.actionItems || []).map(
        (a) => `- [${a.owner || "Unassigned"}] ${a.task}`
      ),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    const original = copyTextBtn.textContent;
    copyTextBtn.textContent = "Copied!";
    setTimeout(() => (copyTextBtn.textContent = original), 2000);
  }

  async function refreshCount(justIncremented) {
    try {
      const res = await fetch("/api/count");
      const data = await res.json();
      if (typeof data.total === "number" && data.total > 0) {
        footerNote.textContent = `${data.total.toLocaleString()} recaps generated so far`;
      }
    } catch {
      // Non-critical; leave the default footer note in place.
    }
  }

  generateBtn.addEventListener("click", handleGenerate);
  copyLinkBtn.addEventListener("click", handleCopyLink);
  copyTextBtn.addEventListener("click", handleCopyText);

  refreshCount(false);
})();
