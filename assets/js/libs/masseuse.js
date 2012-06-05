function listenForTouches() {
  if (!'ontouchstart' in window) {
    return $('a').live('click', function(e) { catchModals(e) })
  }

  turnOffClick(['a', 'input'])
  
  $('a').live('tap', function(e) { catchModals(e) })
  
  $('input').live('tap', function(e) {
    e.preventDefault()
    var el = $(e.target)
    var type = e.target.type
    if (type === "checkbox") {
      el[0].checked = !el[0].checked
      el.attr('checked', el[0].checked)
    } else {
      if (el.hasClass('disabled')) return false
      // hack around mobile safari bug
      if (type === "datetime") return setTimeout(function() { el.focus() }, 0)
      el.focus()
    }
    return false
  })
}

function turnOffClick(elems) {
  elems.forEach(function(el) {
    $(el).live('click', function(e) {
      e.preventDefault()
      return false
    })
  })
} 

function catchModals( event ) {
  var route = $(event.currentTarget).attr('href')
  if (!route) return false
  // Basic rules:
  // * If the href ends with a bang (!) we're going to emit an event
  // * Otherwise, we're going to change the page href
  if ( route && route.indexOf( '!' ) === ( route.length - 1 ) ) {
    route = route.replace('#/', '') // Trim off the #/ from the beginning of the route if it exists
    route = route.substr(0, route.lastIndexOf('!'))
    var id = route.split('/')[1] // The ID (if one exists) will be what comes after the slash
    if (id) route = route.split('/')[0] // If there is an ID, then we have to trim it off the route
    app.emitter.emit('modal', route)
    if (typeof event === 'object') event.preventDefault()
  } else {
    redirect(route)
  }
}

function redirect(uri) {
  window.location.href = uri
}

module.exports = {
  listenForTouches: listenForTouches,
  turnOffClick: turnOffClick,
  catchModals: catchModals,
  redirect: redirect
}
