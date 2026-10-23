
const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

const form = document.getElementById("search-form");
const input = document.getElementById("city-input");
const button = document.getElementById("search-btn");
const statusText = document.getElementById("status");
const weatherSection = document.getElementById("weather");
const welcome = document.getElementById("welcome");

let weatherData = null;
let selectedUnit = "celsius";
let requestId = 0;

const weatherCodes = {
    0: ["Clear sky", "☀️"],
    1: ["Mainly clear", "🌤️"],
    2: ["Partly cloudy", "⛅"],
    3: ["Overcast", "☁️"],
    45: ["Foggy", "🌫️"],
    48: ["Rime fog", "🌫️"],
    51: ["Light drizzle", "🌦️"],
    53: ["Drizzle", "🌦️"],
    55: ["Heavy drizzle", "🌧️"],
    61: ["Light rain", "🌦️"],
    63: ["Rain", "🌧️"],
    65: ["Heavy rain", "🌧️"],
    71: ["Light snow", "🌨️"],
    73: ["Snow", "🌨️"],
    75: ["Heavy snow", "❄️"],
    80: ["Rain showers", "🌦️"],
    81: ["Rain showers", "🌧️"],
    82: ["Heavy showers", "⛈️"],
    95: ["Thunderstorm", "⛈️"],
    96: ["Thunderstorm with hail", "⛈️"],
    99: ["Severe thunderstorm", "⛈️"]
};

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const city = input.value.trim();

    if (city.length < 2 || !/[\p{L}\p{N}]/u.test(city)) {
        showError("Please enter a valid city name.");
        return;
    }

    await searchCity(city);
});

async function searchCity(city) {
    const id = ++requestId;
    setLoading(true);
    statusText.classList.remove("error");
    statusText.textContent = `Searching weather for ${city}...`;

    try {
        const geoResponse = await fetch(
            `${GEO_URL}?name=${encodeURIComponent(city)}&count=10&language=en&format=json`
        );

        if (!geoResponse.ok) throw new Error("Unable to search for this city.");

        const geo = await geoResponse.json();

        if (!geo.results || geo.results.length === 0) {
            throw new Error("City not found. Check the spelling and try again.");
        }

        // Prefer an exact city-name match when multiple results exist.
        const place = geo.results.find(
            item => item.name.toLowerCase() === city.toLowerCase()
        ) || geo.results[0];

        const params = new URLSearchParams({
            latitude: place.latitude,
            longitude: place.longitude,
            current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,surface_pressure",
            daily: "weather_code,temperature_2m_max,temperature_2m_min",
            timezone: "auto",
            forecast_days: "6",
            temperature_unit: selectedUnit === "celsius"
                ? "celsius" : "fahrenheit",
            wind_speed_unit: selectedUnit === "celsius"
                ? "kmh" : "mph"
        });

        const response = await fetch(`${WEATHER_URL}?${params}`);

        if (!response.ok) {
            throw new Error("Unable to retrieve weather data. Try again.");
        }

        const data = await response.json();

        if (id !== requestId) return;

        weatherData = { place, data };
        renderWeather();
        statusText.textContent =
            `Weather loaded for ${place.name}, ${place.country}.`;

    } catch (error) {
        if (id !== requestId) return;
        statusText.textContent = error.message ||
            "Something went wrong. Please try again.";
        statusText.classList.add("error");

    } finally {
        if (id === requestId) setLoading(false);
    }
}

function setLoading(loading) {
    button.disabled = loading;
    button.textContent = loading ? "Loading..." : "Search →";
}

function showError(message) {
    statusText.textContent = message;
    statusText.classList.add("error");
}

function renderWeather() {
    const { place, data } = weatherData;
    const current = data.current;
    const daily = data.daily;

    weatherSection.hidden = false;
    welcome.hidden = true;

    document.getElementById("city-name").textContent =
        `${place.name}, ${place.country}`;

    document.getElementById("date").textContent =
        new Date(current.time).toLocaleString("en-US", {
            weekday: "long",
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit"
        });

    document.getElementById("temperature").textContent =
        `${Math.round(current.temperature_2m)}°`;

    document.getElementById("feels").textContent =
        `Feels like ${Math.round(current.apparent_temperature)}°`;

    document.getElementById("wind").textContent =
        `${Math.round(current.wind_speed_10m)} ${selectedUnit === "celsius" ? "km/h" : "mph"}`;

    document.getElementById("humidity").textContent =
        `${current.relative_humidity_2m}%`;

    document.getElementById("pressure").textContent =
        `${Math.round(current.surface_pressure)} hPa`;

    const [description, icon] = getWeather(current.weather_code, current.is_day);
    document.getElementById("description").textContent = description;
    document.getElementById("icon").textContent = icon;

    renderForecast(daily);
}

function getWeather(code, isDay = 1) {
    const result = weatherCodes[code] || ["Unknown conditions", "🌡️"];

    if (code === 0) {
        return isDay ? result : ["Clear night", "🌙"];
    }

    if (code === 1 && !isDay) return ["Mostly clear night", "🌙"];
    if (code === 2 && !isDay) return ["Partly cloudy night", "☁️"];

    return result;
}

function renderForecast(daily) {
    const container = document.getElementById("forecast");
    container.replaceChildren();

    // Start at index 1 so today's date isn't repeated.
    for (let i = 1; i <= 5; i++) {
        const [description, icon] = getWeather(daily.weather_code[i]);

        const dayName = new Date(`${daily.time[i]}T12:00:00`)
            .toLocaleDateString("en-US", { weekday: "short" });

        const card = document.createElement("article");
        card.className = "forecast-card";

        const day = document.createElement("p");
        day.className = "day";
        day.textContent = dayName;

        const iconElement = document.createElement("div");
        iconElement.className = "icon";
        iconElement.textContent = icon;

        const desc = document.createElement("p");
        desc.className = "desc";
        desc.textContent = description;

        const temps = document.createElement("p");
        temps.className = "temps";

        const high = document.createElement("span");
        high.textContent = `${Math.round(daily.temperature_2m_max[i])}°`;

        const low = document.createElement("span");
        low.className = "low";
        low.textContent = `${Math.round(daily.temperature_2m_min[i])}°`;

        temps.append(high, low);
        card.append(day, iconElement, desc, temps);
        container.appendChild(card);
    }
}

async function changeUnit(unit) {
    if (selectedUnit === unit) return;

    selectedUnit = unit;
    document.getElementById("celsius").classList.toggle(
        "active", unit === "celsius"
    );
    document.getElementById("fahrenheit").classList.toggle(
        "active", unit === "fahrenheit"
    );

    if (weatherData) {
        await searchCity(weatherData.place.name);
    }
}

document.getElementById("celsius").addEventListener(
    "click", () => changeUnit("celsius")
);

document.getElementById("fahrenheit").addEventListener(
    "click", () => changeUnit("fahrenheit")
);

document.querySelectorAll("[data-city]").forEach((item) => {
    item.addEventListener("click", () => {
        input.value = item.dataset.city;
        form.requestSubmit();
    });
});
