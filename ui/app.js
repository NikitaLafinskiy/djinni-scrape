const API_URL = (window.DJINNI_CONFIG && window.DJINNI_CONFIG.apiUrl) || ""
const AUTH_KEY = "djinniAuth"

const STATUS_LABELS = {
    applied: ["Applied", "ok"],
    dry_run: ["Dry run", "ok"],
    needs_manual: ["Needs manual (questions)", "warn"],
    no_easy_apply_suitable: ["Suitable, no easy apply", "warn"],
    no_easy_apply_unsuitable: ["Unsuitable, no easy apply", ""],
    unsuitable: ["Unsuitable", ""],
    ignored_word: ["Ignored word", ""],
    already_applied: ["Already applied", ""],
    error: ["Error", "danger"],
}

const APPLICATION_TABS = [
    ["Applied", ["applied"]],
    ["Needs manual", ["needs_manual"]],
    ["Suitable, no easy apply", ["no_easy_apply_suitable"]],
    ["Unsuitable, no easy apply", ["no_easy_apply_unsuitable", "unsuitable"]],
    ["Ignored", ["ignored_word"]],
    ["Errors", ["error"]],
    ["All", []],
]

const PLATFORM_LABELS = {djinni: "djinni", nfj: "No Fluff Jobs"}

const app = document.getElementById("app")

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]))

const formatDate = value => value ? new Date(value).toLocaleString() : "—"

const yesNo = value => value === true ? "Yes" : value === false ? "No" : "—"

const toast = message => {
    const element = document.getElementById("toast")
    element.textContent = message
    element.hidden = false
    clearTimeout(toast.timer)
    toast.timer = setTimeout(() => element.hidden = true, 3500)
}

const getAuth = () => {
    try {
        return sessionStorage.getItem(AUTH_KEY)
    } catch {
        return null
    }
}

const setAuth = value => {
    try {
        value ? sessionStorage.setItem(AUTH_KEY, value) : sessionStorage.removeItem(AUTH_KEY)
    } catch {
        // storage unavailable, the session then lasts until reload
    }
    setAuth.memory = value
}

class UnauthorizedError extends Error {}

const api = async (method, path, body) => {
    const response = await fetch(API_URL + path, {
        method,
        headers: {
            authorization: "Basic " + (getAuth() || setAuth.memory || ""),
            ...(body ? {"content-type": "application/json"} : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    })
    if (response.status === 401) {
        setAuth(null)
        throw new UnauthorizedError()
    }
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
        throw new Error(data.error || `Request failed with ${response.status}`)
    }
    return data
}

const statusChip = status => {
    const [label, tone] = STATUS_LABELS[status] || [status, ""]
    return `<span class="chip ${tone}">${escapeHtml(label)}</span>`
}

const applicationsTable = (items, showUser) => items.length === 0
    ? `<p class="muted">No applications here yet.</p>`
    : `<div class="table-wrap"><table>
        <thead><tr>
            <th>Date</th>${showUser ? "<th>User</th>" : ""}<th>Site</th><th>Job</th><th>Company</th><th>Status</th>
            <th>Easy apply</th><th>Suitable</th><th>Details</th>
        </tr></thead>
        <tbody>${items.map(item => `<tr>
            <td class="small">${formatDate(item.updated_at)}</td>
            ${showUser ? `<td><a href="#/users/${item.user_id}">${escapeHtml(item.user_name || item.user_id)}</a></td>` : ""}
            <td><span class="chip">${escapeHtml(PLATFORM_LABELS[item.platform] || item.platform)}</span></td>
            <td class="wrap"><a href="${escapeHtml(item.job_url)}" target="_blank" rel="noopener">${escapeHtml(item.title || item.job_url)}</a></td>
            <td class="wrap">${escapeHtml(item.company_name || "—")}</td>
            <td>${statusChip(item.status)}</td>
            <td>${yesNo(item.easy_apply)}</td>
            <td>${yesNo(item.suitable)}</td>
            <td class="wrap small">${item.matched_word ? `Matched “${escapeHtml(item.matched_word)}”` : ""}${item.error ? `<span class="error">${escapeHtml(item.error)}</span>` : ""}${aiAnswers(item.ai_answers)}</td>
        </tr>`).join("")}</tbody>
    </table></div>`

const aiAnswers = json => {
    let answers = []
    try {
        answers = json ? JSON.parse(json) : []
    } catch {
        return ""
    }
    return answers.length === 0 ? "" : `<details><summary>AI answered ${answers.length} question${answers.length === 1 ? "" : "s"}</summary>${answers.map(({question, answer}) =>
        `<p><strong>${escapeHtml(question)}</strong><br>${escapeHtml(Array.isArray(answer) ? answer.join(", ") : answer)}</p>`).join("")}</details>`
}

const applicationsList = (container, basePath, statuses, showUser, platform) => {
    let items = []
    let next = null
    const load = async more => {
        const params = new URLSearchParams()
        if (statuses.length) params.set("status", statuses.join(","))
        if (platform) params.set("platform", platform)
        if (more && next) params.set("before", next)
        const query = params.toString()
        const page = await api("GET", basePath + (query ? `?${query}` : ""))
        items = more ? items.concat(page.items) : page.items
        next = page.next
        container.innerHTML = applicationsTable(items, showUser)
            + (next ? `<div class="row" style="margin-top:12px"><button type="button" data-more>Load more</button></div>` : "")
        container.querySelector("[data-more]")?.addEventListener("click", () => load(true).catch(handleError))
    }
    return load(false)
}

const handleError = error => {
    if (error instanceof UnauthorizedError) {
        renderLogin("Wrong username or password")
        return
    }
    console.error(error)
    toast(error.message)
}

const renderLogin = message => {
    document.querySelector(".topbar").hidden = true
    app.innerHTML = `<div class="card login">
        <h1>Djinni admin</h1>
        <form>
            <label>Username<input type="text" name="username" autocomplete="username" required></label>
            <label>Password<input type="password" name="password" autocomplete="current-password" required></label>
            ${message ? `<p class="error">${escapeHtml(message)}</p>` : ""}
            <button class="primary" type="submit">Log in</button>
        </form>
    </div>`
    app.querySelector("form").addEventListener("submit", event => {
        event.preventDefault()
        const form = new FormData(event.target)
        setAuth(btoa(`${form.get("username")}:${form.get("password")}`))
        route()
    })
}

const renderUsers = async () => {
    const users = await api("GET", "/users")
    app.innerHTML = `
        <div class="row spread"><h1>Users</h1></div>
        <div class="card">
            <h2>Add user</h2>
            <form class="grid" id="create-user">
                <label>Name<input type="text" name="name" required></label>
                <label>Djinni email<input type="email" name="djinni_email"></label>
                <label>No Fluff Jobs email<input type="email" name="nfj_email"></label>
                <div class="row" style="align-self:end"><button class="primary" type="submit">Create</button></div>
            </form>
            <p class="muted small">At least one email is needed. Passwords are set directly in the database: <code>UPDATE users SET djinni_password = '…', nfj_password = '…' WHERE id = '…'</code></p>
        </div>
        <div class="card table-wrap">${users.length === 0 ? `<p class="muted">No users yet.</p>` : `<table>
            <thead><tr><th>Name</th><th>Email</th><th>Active</th><th>Sites</th><th>URLs</th><th>Last activity</th><th></th></tr></thead>
            <tbody>${users.map(user => `<tr>
                <td><a href="#/users/${user.id}">${escapeHtml(user.name)}</a></td>
                <td>${escapeHtml(user.djinni_email || user.nfj_email)}</td>
                <td>${user.active ? `<span class="chip ok">Active</span>` : `<span class="chip">Paused</span>`}</td>
                <td>${platformChip("djinni", user.djinni_enabled, user.djinni_email, user.has_password)} ${platformChip("NFJ", user.nfj_enabled, user.nfj_email, user.has_nfj_password)}</td>
                <td>${user.url_count}</td>
                <td class="small">${formatDate(user.last_application_at)}</td>
                <td class="row">
                    <button type="button" data-run="${user.id}">Run now</button>
                    <button type="button" class="danger" data-delete="${user.id}" data-name="${escapeHtml(user.name)}">Delete</button>
                </td>
            </tr>`).join("")}</tbody>
        </table>`}</div>`

    app.querySelector("#create-user").addEventListener("submit", async event => {
        event.preventDefault()
        const form = new FormData(event.target)
        try {
            const user = await api("POST", "/users", {
                name: form.get("name"),
                djinni_email: form.get("djinni_email"),
                nfj_email: form.get("nfj_email"),
            })
            location.hash = `#/users/${user.id}`
        } catch (error) {
            handleError(error)
        }
    })
    bindRunAndDelete()
}

const platformChip = (label, enabled, email, hasPassword) => {
    if (!email) return ""
    if (!enabled) return `<span class="chip">${label}: off</span>`
    return hasPassword ? `<span class="chip ok">${label}</span>` : `<span class="chip danger">${label}: no password</span>`
}

const bindRunAndDelete = () => {
    app.querySelectorAll("[data-run]").forEach(button => button.addEventListener("click", async () => {
        try {
            const {enqueued} = await api("POST", `/users/${button.dataset.run}/run`)
            toast(enqueued ? `Started ${enqueued} scrape${enqueued === 1 ? "" : "s"}` : "Nothing to run: needs an active URL on an enabled site with an email and password set (and an apply message for djinni)")
        } catch (error) {
            handleError(error)
        }
    }))
    app.querySelectorAll("[data-delete]").forEach(button => button.addEventListener("click", async () => {
        if (!confirm(`Delete ${button.dataset.name} with all their URLs, ignore words and applications?`)) return
        try {
            await api("DELETE", `/users/${button.dataset.delete}`)
            toast("User deleted")
            location.hash === "#/users" ? route() : location.hash = "#/users"
        } catch (error) {
            handleError(error)
        }
    }))
}

const renderUser = async id => {
    const user = await api("GET", `/users/${id}`)
    app.innerHTML = `
        <div class="row spread">
            <h1>${escapeHtml(user.name)}</h1>
            <div class="row">
                <button type="button" data-run="${user.id}">Run now</button>
                <button type="button" class="danger" data-delete="${user.id}" data-name="${escapeHtml(user.name)}">Delete</button>
            </div>
        </div>
        <div class="card">
            <form id="user-form">
                <div class="grid">
                    <label>Name<input type="text" name="name" value="${escapeHtml(user.name)}" required></label>
                    <label class="inline"><input type="checkbox" name="active" ${user.active ? "checked" : ""}> Active (included in scheduled runs)</label>
                </div>
                <label style="margin-top:12px">Candidate information (used by the AI to answer recruiter questions as the candidate: experience, skills, stack, languages, location, notice period, salary expectations, work preferences…)
                    <textarea name="candidate_info" style="min-height:200px">${escapeHtml(user.candidate_info)}</textarea>
                </label>
                <div class="row spread" style="margin-top:20px">
                    <h2 style="margin:0">djinni</h2>
                    <label class="inline"><input type="checkbox" name="djinni_enabled" ${user.djinni_enabled ? "checked" : ""}> Enabled</label>
                </div>
                <div class="grid">
                    <label>Email<input type="email" name="djinni_email" value="${escapeHtml(user.djinni_email)}"></label>
                    <label class="inline"><input type="checkbox" name="skip_ukraine_only" ${user.skip_ukraine_only ? "checked" : ""}> Skip jobs that only consider candidates from Ukraine</label>
                </div>
                <label style="margin-top:12px">Apply message (typed into the easy apply form)
                    <textarea name="apply_message">${escapeHtml(user.apply_message)}</textarea>
                </label>
                <p class="small muted">Password: ${passwordStatus(user.djinni_email, user.has_password)}</p>
                <div class="row spread" style="margin-top:20px">
                    <h2 style="margin:0">No Fluff Jobs</h2>
                    <label class="inline"><input type="checkbox" name="nfj_enabled" ${user.nfj_enabled ? "checked" : ""}> Enabled</label>
                </div>
                <div class="grid">
                    <label>Email<input type="email" name="nfj_email" value="${escapeHtml(user.nfj_email)}"></label>
                    <label>Phone (required by the apply form)<input type="text" name="nfj_phone" value="${escapeHtml(user.nfj_phone)}"></label>
                    <label>Accepted locations (comma separated)<input type="text" name="nfj_locations" value="${escapeHtml(user.nfj_locations)}"></label>
                    <label>Known languages (comma separated)<input type="text" name="nfj_languages" value="${escapeHtml(user.nfj_languages)}"></label>
                    <label class="inline"><input type="checkbox" name="nfj_require_english" ${user.nfj_require_english ? "checked" : ""}> Only jobs with English recruitment</label>
                </div>
                <label style="margin-top:12px">Message to the recruiter (optional)
                    <textarea name="nfj_apply_message">${escapeHtml(user.nfj_apply_message)}</textarea>
                </label>
                <div class="row spread" style="margin-top:12px">
                    <span class="small muted">Password: ${passwordStatus(user.nfj_email, user.has_nfj_password)}</span>
                    <button class="primary" type="submit">Save</button>
                </div>
            </form>
        </div>
        <div class="grid">
            <div class="card">
                <h2>Search URLs</h2>
                <ul class="list">${user.urls.map(url => `<li>
                    <input type="checkbox" title="Active" data-url-toggle="${url.id}" ${url.active ? "checked" : ""}>
                    <span class="chip">${escapeHtml(PLATFORM_LABELS[url.platform] || url.platform)}</span>
                    <a class="grow small" href="${escapeHtml(url.url)}" target="_blank" rel="noopener">${escapeHtml(url.url)}</a>
                    <button type="button" class="link" data-url-delete="${url.id}">Remove</button>
                </li>`).join("") || `<li class="muted">No URLs yet</li>`}</ul>
                <form class="row" id="url-form">
                    <input type="url" name="url" placeholder="https://djinni.co/jobs/?... or https://nofluffjobs.com/pl/..." required style="flex:1">
                    <button type="submit">Add</button>
                </form>
            </div>
            <div class="card">
                <h2>Ignore words</h2>
                <p class="muted small">Jobs whose page contains any of these anywhere (case-insensitive) are skipped.</p>
                <ul class="list">${user.ignore_words.map(word => `<li>
                    <span class="grow">${escapeHtml(word.word)}</span>
                    <button type="button" class="link" data-word-delete="${word.id}">Remove</button>
                </li>`).join("") || `<li class="muted">No ignore words yet</li>`}</ul>
                <form class="row" id="word-form">
                    <input type="text" name="word" placeholder="e.g. igaming" required style="flex:1">
                    <button type="submit">Add</button>
                </form>
            </div>
        </div>
        <div class="card">
            <h2>Applications</h2>
            <div class="row spread">
                <div class="tabs">${APPLICATION_TABS.map(([label], i) => `<button type="button" data-tab="${i}" class="${i === 0 ? "active" : ""}">${label}</button>`).join("")}</div>
                ${platformSelect("applications-platform")}
            </div>
            <div id="applications"></div>
        </div>`

    const action = fn => async event => {
        event.preventDefault()
        try {
            await fn(event)
            await renderUser(id)
        } catch (error) {
            handleError(error)
        }
    }

    app.querySelector("#user-form").addEventListener("submit", action(async event => {
        const form = event.target
        await api("PATCH", `/users/${id}`, {
            name: form.name.value,
            candidate_info: form.candidate_info.value,
            djinni_email: form.djinni_email.value,
            apply_message: form.apply_message.value,
            active: form.active.checked,
            skip_ukraine_only: form.skip_ukraine_only.checked,
            djinni_enabled: form.djinni_enabled.checked,
            nfj_enabled: form.nfj_enabled.checked,
            nfj_email: form.nfj_email.value,
            nfj_phone: form.nfj_phone.value,
            nfj_locations: form.nfj_locations.value,
            nfj_languages: form.nfj_languages.value,
            nfj_require_english: form.nfj_require_english.checked,
            nfj_apply_message: form.nfj_apply_message.value,
        })
        toast("Saved")
    }))
    app.querySelector("#url-form").addEventListener("submit", action(event =>
        api("POST", `/users/${id}/urls`, {url: event.target.url.value})))
    app.querySelector("#word-form").addEventListener("submit", action(event =>
        api("POST", `/users/${id}/ignore-words`, {word: event.target.word.value})))
    app.querySelectorAll("[data-url-toggle]").forEach(input => input.addEventListener("change", action(() =>
        api("PATCH", `/users/${id}/urls/${input.dataset.urlToggle}`, {active: input.checked}))))
    app.querySelectorAll("[data-url-delete]").forEach(button => button.addEventListener("click", action(() =>
        api("DELETE", `/users/${id}/urls/${button.dataset.urlDelete}`))))
    app.querySelectorAll("[data-word-delete]").forEach(button => button.addEventListener("click", action(() =>
        api("DELETE", `/users/${id}/ignore-words/${button.dataset.wordDelete}`))))
    bindRunAndDelete()

    const container = app.querySelector("#applications")
    const platformInput = app.querySelector("#applications-platform")
    let tab = 0
    const loadApplications = () =>
        applicationsList(container, `/users/${id}/applications`, APPLICATION_TABS[tab][1], false, platformInput.value)
    app.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", () => {
        app.querySelectorAll("[data-tab]").forEach(other => other.classList.toggle("active", other === button))
        tab = Number(button.dataset.tab)
        loadApplications().catch(handleError)
    }))
    platformInput.addEventListener("change", () => loadApplications().catch(handleError))
    await loadApplications()
}

const passwordStatus = (email, hasPassword) => !email
    ? "not used (no email)"
    : hasPassword ? "set" : `<span class="error">missing, set it in the database</span>`

const platformSelect = id => `<select id="${id}" class="platform-select">
    <option value="">All sites</option>
    ${Object.entries(PLATFORM_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}
</select>`

const renderNotApplied = async () => {
    app.innerHTML = `
        <div class="row spread"><h1>Not applied</h1>${platformSelect("not-applied-platform")}</div>
        <div class="card">
            <h2>Suitable, apply manually</h2>
            <p class="muted small">Jobs that fit but have no easy apply, or ask recruiter questions.</p>
            <div id="suitable"></div>
        </div>
        <div class="card">
            <div class="row spread">
                <h2>Unsuitable, no easy apply</h2>
                <label class="inline"><input type="checkbox" id="show-unsuitable"> Show</label>
            </div>
            <p class="muted small">Jobs where djinni says your profile does not meet the requirements, that only consider candidates from Ukraine, or (No Fluff Jobs) without English recruitment or an accepted location.</p>
            <div id="unsuitable"></div>
        </div>`
    const platformInput = app.querySelector("#not-applied-platform")
    const showUnsuitable = app.querySelector("#show-unsuitable")
    const loadUnsuitable = () => {
        const container = app.querySelector("#unsuitable")
        return showUnsuitable.checked
            ? applicationsList(container, "/applications", ["no_easy_apply_unsuitable", "unsuitable"], true, platformInput.value)
            : Promise.resolve(container.innerHTML = "")
    }
    const loadSuitable = () =>
        applicationsList(app.querySelector("#suitable"), "/applications", ["no_easy_apply_suitable", "needs_manual"], true, platformInput.value)
    showUnsuitable.addEventListener("change", () => loadUnsuitable().catch(handleError))
    platformInput.addEventListener("change", () => Promise.all([loadSuitable(), loadUnsuitable()]).catch(handleError))
    await loadSuitable()
}

const route = async () => {
    if (!getAuth() && !setAuth.memory) {
        renderLogin()
        return
    }
    document.querySelector(".topbar").hidden = false
    const hash = location.hash || "#/users"
    const userMatch = hash.match(/^#\/users\/([0-9a-f-]{36})$/)
    const section = userMatch || hash.startsWith("#/users") ? "users" : hash.replace("#/", "")
    document.querySelectorAll("[data-nav]").forEach(link => link.classList.toggle("active", link.dataset.nav === section))
    app.innerHTML = `<p class="muted">Loading…</p>`
    try {
        if (userMatch) {
            await renderUser(userMatch[1])
        } else if (hash === "#/not-applied") {
            await renderNotApplied()
        } else {
            await renderUsers()
        }
    } catch (error) {
        handleError(error)
    }
}

document.getElementById("logout").addEventListener("click", () => {
    setAuth(null)
    renderLogin()
})
window.addEventListener("hashchange", route)
route()
