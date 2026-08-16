self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {}
  event.waitUntil(
    self.registration.showNotification(data.title || "Miles Dance Studio", {
      body: data.body || "Нове повідомлення",
      icon: "/owner-avatar.png",
      badge: "/favicon.ico",
      tag: data.type || "miles-notification",
      data: { link: data.link || "/dashboard" },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const link = event.notification.data?.link || "/dashboard"
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const target = new URL(link, self.location.origin).href
        for (const client of clients) {
          if (client.url === target && "focus" in client) return client.focus()
        }
        return self.clients.openWindow(target)
      })
  )
})
