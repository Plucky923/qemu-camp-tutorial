(function () {
    "use strict";

    function isLocalhost() {
        return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    }

    function getApiBase(component) {
        var value = isLocalhost() ? component.dataset.localApiBase : component.dataset.apiBase;
        return (value || "").replace(/\/$/, "");
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

    function initLookup(component, apiBase) {
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
                        setLookupResult(component, "@" + payload.login + " 已报名", "success");
                        return;
                    }
                    setLookupResult(component, "@" + login + " 尚未报名", "idle");
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

        var apiBase = getApiBase(component);
        var action = component.querySelector("[data-enrollment-action]");
        if (!apiBase || !action) {
            setStatus(component, "报名入口配置不完整", "offline");
            return;
        }

        action.href = apiBase + "/auth/github";
        if (new URLSearchParams(window.location.search).get("enrollment") === "success") {
            setStatus(component, "报名成功，正在同步状态...", "success");
        }
        initLookup(component, apiBase);
        refreshEnrollment(component, apiBase);
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
