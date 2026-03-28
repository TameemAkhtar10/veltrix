const TAVILY_ENDPOINT = "https://api.tavily.com/search";

export function isTavilyConfigured() {
    return Boolean(process.env.TAVILY_API_KEY);
}

export async function tavilySearch(query) {
    try {
        if (!query || typeof query !== "string") {
            return [];
        }

        if (!isTavilyConfigured()) {
            return [];
        }

        const apiKey = process.env.TAVILY_API_KEY;

        const response = await fetch(TAVILY_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                api_key: apiKey,
                query,
                search_depth: "advanced",
                max_results: 5
            })
        });

        if (!response.ok) {
            return [];
        }

        const data = await response.json();
        return Array.isArray(data?.results) ? data.results : [];
    } catch (error) {
        return [];
    }
}