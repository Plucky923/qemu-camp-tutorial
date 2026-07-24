(function () {
    "use strict";

    function getApiBase(config) {
        return (config.api_base || "").replace(/\/$/, "");
    }

    function loadConfig(component) {
        var configUrl = component.dataset.enrollmentConfig;
        if (!configUrl) {
            return Promise.reject(new Error("Enrollment config URL is missing"));
        }

        return fetch(new URL(configUrl, window.location.href), {
            cache: "no-cache",
            headers: { Accept: "application/json" }
        })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error("Enrollment config returned " + response.status);
                }
                return response.json();
            })
            .then(function (config) {
                var year = Number(config.current_year);
                var availableYears = Array.isArray(config.available_years)
                    ? config.available_years.map(Number)
                    : [];
                if (!Number.isInteger(year) || availableYears.indexOf(year) === -1) {
                    throw new Error("Current enrollment year is invalid");
                }
                if (!config.program_name || !getApiBase(config)) {
                    throw new Error("Enrollment config is incomplete");
                }
                config.current_year = year;
                return config;
            });
    }

    function applyConfig(component, config) {
        var camp = component.querySelector("[data-enrollment-camp]");
        if (camp) {
            camp.textContent = config.program_name + " " + config.current_year;
        }
    }

    function setStatus(component, message, state) {
        var status = component.querySelector("[data-enrollment-status]");
        if (!status) {
            return;
        }
        status.textContent = message;
        status.dataset.state = state || "idle";
    }

    function markEnrolled(component, login) {
        var action = component.querySelector("[data-enrollment-action]");
        if (action) {
            action.textContent = "已完成报名";
            action.setAttribute("aria-disabled", "true");
            action.removeAttribute("href");
        }
        setStatus(component, login ? "GitHub 账号：@" + login : "报名信息已确认", "success");
    }

    function refreshEnrollment(component, apiBase) {
        return fetch(apiBase + "/api/enrollment", {
            credentials: "include",
            headers: { Accept: "application/json" }
        })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error("Enrollment API returned " + response.status);
                }
                return response.json();
            })
            .then(function (payload) {
                if (payload.enrolled) {
                    markEnrolled(component, payload.user && payload.user.login);
                    return;
                }
                setStatus(component, "尚未使用 GitHub 报名", "idle");
            })
            .catch(function () {
                setStatus(component, "报名服务暂未连接", "offline");
            });
    }

    function setLookupResult(component, message, state) {
        var result = component.querySelector("[data-enrollment-lookup-result]");
        if (!result) {
            return;
        }
        result.textContent = message;
        result.dataset.state = state || "idle";
    }

    function initLookup(component, apiBase, currentYear) {
        var form = component.querySelector("[data-enrollment-lookup]");
        if (!form) {
            return;
        }

        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var input = form.elements.github_login;
            var button = form.querySelector("button[type='submit']");
            var login = input.value.trim();
            var validLogin = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(login);

            if (!validLogin) {
                setLookupResult(component, "请输入有效的 GitHub 用户名", "error");
                return;
            }

            button.disabled = true;
            setLookupResult(component, "正在查询...", "idle");
            fetch(apiBase + "/api/enrollments/" + encodeURIComponent(login), {
                credentials: "include",
                headers: { Accept: "application/json" }
            })
                .then(function (response) {
                    if (!response.ok) {
                        throw new Error("Enrollment lookup returned " + response.status);
                    }
                    return response.json();
                })
                .then(function (payload) {
                    if (payload.enrolled) {
                        setLookupResult(
                            component,
                            "@" + payload.login + " 已报名 " + (payload.year || currentYear) + " 届",
                            "success"
                        );
                        return;
                    }
                    setLookupResult(component, "@" + login + " 尚未报名 " + currentYear + " 届", "idle");
                })
                .catch(function () {
                    setLookupResult(component, "查询失败，请稍后重试", "error");
                })
                .finally(function () {
                    button.disabled = false;
                });
        });
    }

    function initComponent(component) {
        if (component.dataset.enrollmentInit === "true") {
            return;
        }
        component.dataset.enrollmentInit = "true";

        var action = component.querySelector("[data-enrollment-action]");
        if (!action) {
            setStatus(component, "报名入口配置不完整", "offline");
            return;
        }

        loadConfig(component)
            .then(function (config) {
                var apiBase = getApiBase(config);
                applyConfig(component, config);
                action.href = apiBase + "/auth/github";
                action.removeAttribute("aria-disabled");
                if (new URLSearchParams(window.location.search).get("enrollment") === "success") {
                    setStatus(component, "报名成功，正在同步状态...", "success");
                }
                initLookup(component, apiBase, config.current_year);
                return refreshEnrollment(component, apiBase);
            })
            .catch(function () {
                setStatus(component, "报名配置加载失败", "offline");
            });
    }

    function init(root) {
        if (!root || !root.querySelectorAll) {
            return;
        }
        root.querySelectorAll("[data-enrollment]").forEach(initComponent);
    }

    if (window.document$ && typeof window.document$.subscribe === "function") {
        window.document$.subscribe(function (documentRoot) {
            init(documentRoot);
        });
    } else if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            init(document);
        });
    } else {
        init(document);
    }
})();
