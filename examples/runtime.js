process.stdin.setEncoding("utf8");

let input = "";
process.stdin.on("data", (chunk) => {
  input += chunk;
});

process.stdin.on("end", () => {
  const request = JSON.parse(input);
  const summary = `Script runtime completed ${request.workOrder.title}`;
  process.stdout.write(
    JSON.stringify({
      submissionDraft: {
        summary,
        artifacts: [{ uri: `script://submission/${request.workOrder.id}`, mediaType: "text/plain" }],
      },
      executionReceipt: { status: "success" },
    }),
  );
});
