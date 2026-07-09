(function () {
    "use strict";

    function createElement(tagName, className, text) {
        var element = document.createElement(tagName);
        if (className) {
            element.className = className;
        }
        if (typeof text === "string") {
            element.textContent = text;
        }
        return element;
    }

    function clearNode(node) {
        while (node.firstChild) {
            node.removeChild(node.firstChild);
        }
    }

    function formatNumber(value) {
        return Number(value || 0).toLocaleString("zh-CN");
    }

    function getDimensionTotal(dimension) {
        return (dimension.items || []).reduce(function (sum, item) {
            return sum + Number(item.count || 0);
        }, 0);
    }

    function renderBars(container, dimension) {
        var items = dimension.items || [];
        var maxCount = items.reduce(function (max, item) {
            return Math.max(max, Number(item.count || 0));
        }, 0);
        var list = createElement("div", "qemu-registration-stats__bars");

        items.forEach(function (item) {
            var row = createElement("div", "qemu-registration-stats__bar-row");
            var label = createElement("div", "qemu-registration-stats__bar-label", item.name);
            var track = createElement("div", "qemu-registration-stats__bar-track");
            var fill = createElement("div", "qemu-registration-stats__bar-fill");
            var value = createElement("div", "qemu-registration-stats__bar-value", formatNumber(item.count) + dimension.personUnit);
            var ratio = maxCount > 0 ? Number(item.count || 0) / maxCount : 0;

            fill.style.width = Math.max(2, ratio * 100) + "%";
            track.appendChild(fill);
            row.appendChild(label);
            row.appendChild(track);
            row.appendChild(value);
            list.appendChild(row);
        });

        container.appendChild(list);
    }

    function renderRanking(container, dimension) {
        var list = createElement("ol", "qemu-registration-stats__ranking");

        (dimension.items || []).forEach(function (item, index) {
            var row = createElement("li", "qemu-registration-stats__rank-row");
            var rank = createElement("span", "qemu-registration-stats__rank-index", String(index + 1));
            var name = createElement("span", "qemu-registration-stats__rank-name", item.name);
            var count = createElement("span", "qemu-registration-stats__rank-count", formatNumber(item.count) + dimension.personUnit);

            row.appendChild(rank);
            row.appendChild(name);
            row.appendChild(count);
            list.appendChild(row);
        });

        container.appendChild(list);
    }

    function renderComponent(component, payload) {
        var dimensions = payload.dimensions || [];
        var activeIndex = 0;
        var title = component.getAttribute("data-registration-title") || "报名数据统计";

        clearNode(component);

        var header = createElement("div", "qemu-registration-stats__header");
        var titleElement = createElement("div", "qemu-registration-stats__title", title);
        header.appendChild(titleElement);

        var tabs = createElement("div", "qemu-registration-stats__tabs");
        tabs.setAttribute("role", "tablist");
        var metrics = createElement("div", "qemu-registration-stats__metrics");
        var body = createElement("div", "qemu-registration-stats__body");
        var chartPanel = createElement("section", "qemu-registration-stats__chart-panel");
        var chartHeading = createElement("h3", "qemu-registration-stats__panel-title");
        var chartScroll = createElement("div", "qemu-registration-stats__scroll qemu-registration-stats__scroll--chart");
        var rankingPanel = createElement("section", "qemu-registration-stats__rank-panel");
        var rankingHeading = createElement("h3", "qemu-registration-stats__panel-title");
        var rankingScroll = createElement("div", "qemu-registration-stats__scroll qemu-registration-stats__scroll--ranking");

        chartPanel.appendChild(chartHeading);
        chartPanel.appendChild(chartScroll);
        rankingPanel.appendChild(rankingHeading);
        rankingPanel.appendChild(rankingScroll);
        body.appendChild(chartPanel);
        body.appendChild(rankingPanel);

        function renderActiveDimension() {
            var dimension = dimensions[activeIndex];
            if (!dimension) {
                return;
            }

            Array.prototype.forEach.call(tabs.querySelectorAll("button"), function (button, index) {
                var active = index === activeIndex;
                button.classList.toggle("is-active", active);
                button.setAttribute("aria-selected", active ? "true" : "false");
                button.tabIndex = active ? 0 : -1;
            });

            clearNode(metrics);
            if (payload.totalSignups) {
                var totalMetric = createElement("div", "qemu-registration-stats__metric qemu-registration-stats__metric--primary");
                totalMetric.appendChild(createElement("span", "qemu-registration-stats__metric-value", formatNumber(payload.totalSignups) + "人"));
                totalMetric.appendChild(createElement("span", "qemu-registration-stats__metric-label", "总报名人数"));
                metrics.appendChild(totalMetric);
            }
            var itemMetric = createElement("div", "qemu-registration-stats__metric");
            itemMetric.appendChild(createElement("span", "qemu-registration-stats__metric-value", formatNumber(dimension.items.length) + dimension.unit));
            itemMetric.appendChild(createElement("span", "qemu-registration-stats__metric-label", dimension.label + "统计项"));
            var peopleMetric = createElement("div", "qemu-registration-stats__metric");
            peopleMetric.appendChild(createElement("span", "qemu-registration-stats__metric-value", formatNumber(getDimensionTotal(dimension)) + dimension.personUnit));
            peopleMetric.appendChild(createElement("span", "qemu-registration-stats__metric-label", "对应维度人数"));
            metrics.appendChild(itemMetric);
            metrics.appendChild(peopleMetric);

            chartHeading.textContent = dimension.label + "报名排行";
            rankingHeading.textContent = dimension.label + "报名列表";
            clearNode(chartScroll);
            clearNode(rankingScroll);
            renderBars(chartScroll, dimension);
            renderRanking(rankingScroll, dimension);
            chartScroll.scrollTop = 0;
            rankingScroll.scrollTop = 0;
        }

        dimensions.forEach(function (dimension, index) {
            var button = createElement(
                "button",
                "qemu-registration-stats__tab",
                dimension.label + "报名统计（" + formatNumber(dimension.items.length) + dimension.unit + "）"
            );
            button.type = "button";
            button.setAttribute("role", "tab");
            button.addEventListener("click", function () {
                activeIndex = index;
                renderActiveDimension();
            });
            tabs.appendChild(button);
        });

        component.appendChild(header);
        component.appendChild(tabs);
        component.appendChild(metrics);
        component.appendChild(body);
        renderActiveDimension();
    }

    function loadComponent(component) {
        var src = component.getAttribute("data-registration-src");
        if (!src || component.dataset.registrationStatsInit === "true") {
            return;
        }
        component.dataset.registrationStatsInit = "true";
        component.textContent = "报名数据加载中...";

        fetch(src)
            .then(function (response) {
                if (!response.ok) {
                    throw new Error("Failed to load " + src);
                }
                return response.json();
            })
            .then(function (payload) {
                renderComponent(component, payload);
            })
            .catch(function () {
                component.classList.add("qemu-registration-stats--error");
                component.textContent = "报名数据加载失败，请检查数据文件路径。";
            });
    }

    function init(root) {
        if (!root || !root.querySelectorAll) {
            return;
        }
        var components = root.querySelectorAll(".qemu-registration-stats[data-registration-src]");
        components.forEach(loadComponent);
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
