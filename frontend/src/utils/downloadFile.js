/** Fetches a file (PDF, etc.) from the API as a blob and triggers the browser's save dialog. */
export async function downloadFileFromApi(api, url, { method = "get", data, token, filename } = {}) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const config = { headers, responseType: "blob" };

    const response = method === "post" ? await api.post(url, data, config) : await api.get(url, config);

    const blobUrl = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename || "download.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
}
