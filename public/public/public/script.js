document.getElementById('checkButton').addEventListener('click', async () => {
  const mobileNumbers = document.getElementById('mobileNumbers').value
    .split('\n').map(num => num.trim()).filter(Boolean);

  const resultDiv = document.getElementById('result');
  const controlsDiv = document.getElementById('controls');
  const filterSelect = document.getElementById('filterSelect');
  const summaryDiv = document.getElementById('summary');

  resultDiv.textContent = "⏳ Checking started...\n";
  controlsDiv.style.display = 'none';

  try {
    const response = await fetch('/check-topup-bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumbers }),
    });

    if (!response.ok) {
      throw new Error("Server error");
    }

    const data = await response.json();

    let results = data.map(result => ({
      mobileNumber: result.mobileNumber,
      status: result.isTopUpAvailable ? 'Yes' : 'No'
    }));

    controlsDiv.style.display = 'block';

    function renderResults(filter = 'all') {
      let filtered = results;
      if (filter === 'yes') filtered = results.filter(r => r.status === 'Yes');
      else if (filter === 'no') filtered = results.filter(r => r.status === 'No');

      const lines = filtered.map(r => `${r.mobileNumber}\t${r.status}`);
      resultDiv.textContent = `✅ Done: ${filtered.length} numbers\n\n` + lines.join('\n');

      const total = results.length;
      const yesCount = results.filter(r => r.status === 'Yes').length;
      const noCount = total - yesCount;

      summaryDiv.innerHTML = `
        ✅ Total: ${total} &nbsp;&nbsp;
        👍 Yes: ${yesCount} &nbsp;&nbsp;
        👎 No: ${noCount} &nbsp;&nbsp;
        🎯 Filtered: ${filtered.length}
      `;
    }

    renderResults();

    filterSelect.addEventListener('change', () => {
      renderResults(filterSelect.value);
    });

    document.getElementById('copyButton').addEventListener('click', () => {
      navigator.clipboard.writeText(resultDiv.textContent).then(() => {
        alert('✅ Copied to clipboard!');
      });
    });

  } catch (err) {
    resultDiv.textContent = `❌ Error: ${err.message}`;
  }
});
