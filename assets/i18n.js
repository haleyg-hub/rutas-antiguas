/* Rutas Antiguas — interface language.
 *
 * The language follows the guest's phone unless they override it with the
 * toggle. Tour content (names, descriptions) is the operator's own text and is
 * translated separately, per tour, in the editor — never machine-translated.
 *
 * Keys are flat and namespaced by surface. {braces} are interpolated.
 */
window.RA_I18N = (function () {
  'use strict';

  var LANG_KEY = 'rutasantiguas.lang.v1';
  var DEFAULT = 'en';

  var STRINGS = {
    en: {
      'nav.tours': 'Tours',
      'nav.itinerary': 'Itinerary',
      'nav.contact': 'Contact',
      'nav.operator': 'Operator',

      'menu.title': 'Build Your Own Tour',
      'menu.sub': 'Choose any combination of experiences, in any number. We sequence them into one seamless private day.',
      'menu.empty': 'No tours on the menu yet. Tap ⚙ to add your first one.',
      'filter.all': 'All',

      'common.add': 'Add',
      'common.remove': 'Remove',
      'common.daily': 'Daily',
      'common.save': 'Save',
      'common.cancel': 'Cancel',
      'price.perGuest': 'per guest',
      'price.perGroup': 'per group',

      'detail.add': 'Add to my tour',
      'detail.included': 'Included',
      'detail.details': 'Details',
      'spec.duration': 'Duration',
      'spec.price': 'Price',
      'spec.guests': 'Guests',
      'spec.available': 'Available',
      'spec.departures': 'Departures',
      'spec.meeting': 'Meeting point',
      'spec.priceEach': '{amount} per {unit}',
      'unit.guest': 'guest',
      'unit.group': 'group',

      'plan.title': 'Your Itinerary',
      'plan.sub': 'Reorder freely — times recalculate around travel and rest.',
      'plan.date': 'Date',
      'plan.guests': 'Guests',
      'plan.start': 'Start',
      'plan.empty': 'Nothing added yet. Browse the tours and tap Add.',
      'plan.experiences': 'Experiences',
      'plan.timeOnTour': 'Time on tour',
      'plan.dayRuns': 'Day runs',
      'plan.estTotal': 'Estimated total',
      'plan.estimateNote': 'An estimate for the selections above, not a confirmed booking. We will confirm availability and final pricing by reply.',
      'plan.requestTitle': 'Request this tour',
      'plan.moveEarlier': 'Move earlier',
      'plan.moveLater': 'Move later',
      'plan.perLine': '{amount} × {guests} guests = {total}',

      'disclaimer': 'NO TOUR BOOKED UNTIL CONFIRMED BY OUR AGENCY — WE WILL CONTACT YOU DIRECTLY TO CONFIRM.',

      'warn.notOffered': 'Not offered on {day}.',
      'warn.maxGuests': 'Maximum {n} guests.',
      'warn.minGuests': 'Minimum {n} guests.',
      'warn.noDeparture': 'Departs at {times} — no departure left after the previous stop. Move it earlier in the day.',
      'note.dayStarts': 'Day starts at {time} to catch this departure.',
      'note.waits': 'Waits {dur} for the {time} departure.',

      'form.name': 'Name',
      'form.phone': 'Phone number',
      'form.email': 'Email',
      'form.message': 'Message',
      'form.required': 'required',
      'form.namePh': 'Full name',
      'form.phonePh': '+1 555 123 4567',
      'form.emailPh': 'you@example.com',
      'form.messagePhContact': 'Ask us anything — a question about a tour, a private request, dates you have in mind.',
      'form.messagePhBooking': 'Anything we should know — dietary needs, mobility, a celebration, dates you are flexible on.',

      'err.name': 'Please add your name',
      'err.phone': 'Please add a phone number',
      'err.phoneShort': 'That phone number looks too short',
      'err.email': 'Please add an email address',
      'err.emailBad': 'That email address looks incomplete',
      'err.message': 'Please add a message',
      'err.messageLong': 'Message is too long (4000 characters max)',

      'send.whatsapp': 'WhatsApp',
      'send.email': 'Email',
      'send.copy': 'Copy',
      'send.saveNote': 'Your details reach us the moment you send, so nothing is lost if the message does not go through.',
      'send.saving': 'Saving your details…',
      'send.received': 'Message received — we have your details and will reply personally.',
      'send.bookingReceived': 'Request received.',
      'send.failed': 'We could not record this on our side ({err}). Please make sure the message you just opened actually sends.',
      'send.noBackend': 'Sent. Nothing was recorded on our side — reply to the message to keep the thread.',

      'contact.title': 'Contact Us',
      'contact.sub': 'A question about a tour, a private request, or anything else — we answer personally.',
      'contact.direct': 'Or reach us directly',
      'contact.whatsapp': 'WhatsApp us directly',

      'toast.added': 'Added to your tour',
      'toast.requestSent': 'Request sent',
      'toast.messageSent': 'Message sent',
      'toast.handedOff': 'Handed off',
      'toast.notRecorded': 'Not recorded — please send the message',
      'toast.copiedPlan': 'Itinerary copied',
      'toast.copiedFree': 'Copied — paste it to us however you like',
      'toast.copyFailed': 'Copy failed — select the text manually',

      'install.title': 'Keep us on your home screen',
      'install.chrome': 'One tap and it opens full screen with its own icon, no browser bars.',
      'install.ios': 'Tap <b>Share</b> at the bottom of Safari, then <b>Add to Home Screen</b>. It opens full screen with its own icon.',
      'install.button': 'Add to Home Screen',
      'install.done': 'Added to your home screen',
      'install.dismiss': 'Dismiss',

      'txt.requestHeading': '{operator} — Build Your Own Tour request',
      'txt.enquiryHeading': '{operator} — enquiry',
      'txt.date': 'Date',
      'txt.guests': 'Guests',
      'txt.itinerary': 'ITINERARY',
      'txt.meets': 'Meets',
      'txt.timeOnTour': 'Time on tour',
      'txt.estTotal': 'Estimated total',
      'txt.from': 'FROM',
      'txt.name': 'Name',
      'txt.phone': 'Phone',
      'txt.email': 'Email',
      'txt.estimateOnly': 'Estimate only — please confirm availability and final pricing.',
      'txt.dateTBC': 'Date to confirm',
      'txt.subjectBooking': 'Tour request — {date} — {name}',
      'txt.subjectEnquiry': 'Enquiry from {name}',

      'admin.title': 'Operator',
      'admin.sub': 'Edit the menu from your phone. No code, no deploy.',
      'admin.newTour': '+ New tour',
      'admin.brand': 'Brand & contact',
      'admin.backup': 'Backup',
      'admin.publishBackup': 'Publish & backup',
      'admin.export': 'Export tours.json',
      'admin.copyJson': 'Copy JSON',
      'admin.import': 'Import…',
      'admin.reset': 'Reset to published',
      'admin.noTours': 'No tours yet. Tap New tour to build your menu.',
      'admin.hidden': 'hidden',
      'lang.label': 'Language',
      'lang.auto': 'Follows your phone'
    },

    es: {
      'nav.tours': 'Tours',
      'nav.itinerary': 'Itinerario',
      'nav.contact': 'Contacto',
      'nav.operator': 'Operador',

      'menu.title': 'Diseña Tu Propio Tour',
      'menu.sub': 'Elige las experiencias que quieras, en cualquier combinación. Nosotros las encadenamos en una sola jornada privada.',
      'menu.empty': 'Aún no hay tours en el menú. Toca ⚙ para añadir el primero.',
      'filter.all': 'Todos',

      'common.add': 'Añadir',
      'common.remove': 'Quitar',
      'common.daily': 'Todos los días',
      'common.save': 'Guardar',
      'common.cancel': 'Cancelar',
      'price.perGuest': 'por persona',
      'price.perGroup': 'por grupo',

      'detail.add': 'Añadir a mi tour',
      'detail.included': 'Incluye',
      'detail.details': 'Detalles',
      'spec.duration': 'Duración',
      'spec.price': 'Precio',
      'spec.guests': 'Personas',
      'spec.available': 'Disponible',
      'spec.departures': 'Salidas',
      'spec.meeting': 'Punto de encuentro',
      'spec.priceEach': '{amount} por {unit}',
      'unit.guest': 'persona',
      'unit.group': 'grupo',

      'plan.title': 'Tu Itinerario',
      'plan.sub': 'Reordena a tu gusto: los horarios se recalculan con los traslados y las pausas.',
      'plan.date': 'Fecha',
      'plan.guests': 'Personas',
      'plan.start': 'Inicio',
      'plan.empty': 'Todavía no has añadido nada. Explora los tours y toca Añadir.',
      'plan.experiences': 'Experiencias',
      'plan.timeOnTour': 'Tiempo de tour',
      'plan.dayRuns': 'La jornada va',
      'plan.estTotal': 'Total estimado',
      'plan.estimateNote': 'Es una estimación de lo seleccionado, no una reserva confirmada. Te confirmaremos disponibilidad y precio final al responder.',
      'plan.requestTitle': 'Solicita este tour',
      'plan.moveEarlier': 'Mover antes',
      'plan.moveLater': 'Mover después',
      'plan.perLine': '{amount} × {guests} personas = {total}',

      'disclaimer': 'NINGÚN TOUR QUEDA RESERVADO HASTA QUE NUESTRA AGENCIA LO CONFIRME — LE CONTACTAREMOS DIRECTAMENTE PARA CONFIRMARLO.',

      'warn.notOffered': 'No se ofrece los {day}.',
      'warn.maxGuests': 'Máximo {n} personas.',
      'warn.minGuests': 'Mínimo {n} personas.',
      'warn.noDeparture': 'Sale a las {times}: no queda ninguna salida después de la parada anterior. Muévelo antes en el día.',
      'note.dayStarts': 'La jornada empieza a las {time} para tomar esta salida.',
      'note.waits': 'Espera {dur} hasta la salida de las {time}.',

      'form.name': 'Nombre',
      'form.phone': 'Teléfono',
      'form.email': 'Correo electrónico',
      'form.message': 'Mensaje',
      'form.required': 'obligatorio',
      'form.namePh': 'Nombre completo',
      'form.phonePh': '+34 600 123 456',
      'form.emailPh': 'tu@ejemplo.com',
      'form.messagePhContact': 'Pregúntanos lo que quieras: una duda sobre un tour, una petición privada, fechas que tengas en mente.',
      'form.messagePhBooking': 'Algo que debamos saber: dietas o alergias, movilidad, una celebración, fechas flexibles.',

      'err.name': 'Añade tu nombre',
      'err.phone': 'Añade un teléfono',
      'err.phoneShort': 'Ese teléfono parece demasiado corto',
      'err.email': 'Añade un correo electrónico',
      'err.emailBad': 'Ese correo parece incompleto',
      'err.message': 'Escribe un mensaje',
      'err.messageLong': 'El mensaje es demasiado largo (máx. 4000 caracteres)',

      'send.whatsapp': 'WhatsApp',
      'send.email': 'Correo',
      'send.copy': 'Copiar',
      'send.saveNote': 'Tus datos nos llegan en cuanto envías, así no se pierde nada si el mensaje no sale.',
      'send.saving': 'Guardando tus datos…',
      'send.received': 'Mensaje recibido: tenemos tus datos y te responderemos personalmente.',
      'send.bookingReceived': 'Solicitud recibida.',
      'send.failed': 'No hemos podido registrarlo por nuestra parte ({err}). Asegúrate de enviar el mensaje que se acaba de abrir.',
      'send.noBackend': 'Enviado. No se ha registrado por nuestra parte: responde al mensaje para mantener el hilo.',

      'contact.title': 'Contacto',
      'contact.sub': 'Una duda sobre un tour, una petición privada o cualquier otra cosa: respondemos personalmente.',
      'contact.direct': 'O contáctanos directamente',
      'contact.whatsapp': 'Escríbenos por WhatsApp',

      'toast.added': 'Añadido a tu tour',
      'toast.requestSent': 'Solicitud enviada',
      'toast.messageSent': 'Mensaje enviado',
      'toast.handedOff': 'Enviado',
      'toast.notRecorded': 'No registrado: envía el mensaje',
      'toast.copiedPlan': 'Itinerario copiado',
      'toast.copiedFree': 'Copiado: pégalo donde prefieras',
      'toast.copyFailed': 'No se pudo copiar: selecciona el texto a mano',

      'install.title': 'Ténnos en tu pantalla de inicio',
      'install.chrome': 'Un toque y se abre a pantalla completa con su propio icono, sin barras del navegador.',
      'install.ios': 'Toca <b>Compartir</b> abajo en Safari y luego <b>Añadir a pantalla de inicio</b>. Se abre a pantalla completa con su propio icono.',
      'install.button': 'Añadir a pantalla de inicio',
      'install.done': 'Añadido a tu pantalla de inicio',
      'install.dismiss': 'Descartar',

      'txt.requestHeading': '{operator} — solicitud de tour a medida',
      'txt.enquiryHeading': '{operator} — consulta',
      'txt.date': 'Fecha',
      'txt.guests': 'Personas',
      'txt.itinerary': 'ITINERARIO',
      'txt.meets': 'Encuentro',
      'txt.timeOnTour': 'Tiempo de tour',
      'txt.estTotal': 'Total estimado',
      'txt.from': 'DATOS DE CONTACTO',
      'txt.name': 'Nombre',
      'txt.phone': 'Teléfono',
      'txt.email': 'Correo',
      'txt.estimateOnly': 'Solo es una estimación: confirmad disponibilidad y precio final.',
      'txt.dateTBC': 'Fecha por confirmar',
      'txt.subjectBooking': 'Solicitud de tour — {date} — {name}',
      'txt.subjectEnquiry': 'Consulta de {name}',

      'admin.title': 'Operador',
      'admin.sub': 'Edita el menú desde el móvil. Sin código, sin despliegues.',
      'admin.newTour': '+ Nuevo tour',
      'admin.brand': 'Marca y contacto',
      'admin.backup': 'Copia de seguridad',
      'admin.publishBackup': 'Publicar y copia de seguridad',
      'admin.export': 'Exportar tours.json',
      'admin.copyJson': 'Copiar JSON',
      'admin.import': 'Importar…',
      'admin.reset': 'Restaurar lo publicado',
      'admin.noTours': 'Aún no hay tours. Toca Nuevo tour para crear tu menú.',
      'admin.hidden': 'oculto',
      'lang.label': 'Idioma',
      'lang.auto': 'Sigue tu teléfono'
    }
  };

  /* Weekday names, short for the menu meta line and plural for the warning
   * ("Not offered on Fridays" / "No se ofrece los viernes"). */
  var DAYS = {
    en: { short: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
          plural: ['Sundays','Mondays','Tuesdays','Wednesdays','Thursdays','Fridays','Saturdays'] },
    es: { short: ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],
          plural: ['domingos','lunes','martes','miércoles','jueves','viernes','sábados'] }
  };

  var LOCALES = { en: 'en-US', es: 'es-ES' };

  var current = null;

  function supported(code) {
    var base = String(code || '').toLowerCase().split('-')[0];
    return STRINGS[base] ? base : null;
  }

  /* Stored choice wins; otherwise the first phone language we actually speak. */
  function detect() {
    var stored = null;
    try { stored = localStorage.getItem(LANG_KEY); } catch (e) {}
    if (supported(stored)) return supported(stored);

    var list = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language];
    for (var i = 0; i < list.length; i++) {
      var hit = supported(list[i]);
      if (hit) return hit;
    }
    return DEFAULT;
  }

  function get() {
    if (!current) {
      current = detect();
      // Keep <html lang> honest on the auto-detected path too, not just when
      // the guest flips the toggle — assistive tech reads it.
      document.documentElement.lang = current;
    }
    return current;
  }

  function set(code) {
    var lang = supported(code) || DEFAULT;
    current = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    document.documentElement.lang = lang;
    return lang;
  }

  /* Falls back to English rather than showing a raw key — a missing Spanish
   * string should read awkwardly, not break the page. */
  function t(key, vars) {
    var lang = get();
    var s = (STRINGS[lang] && STRINGS[lang][key]);
    if (s == null) s = STRINGS[DEFAULT][key];
    if (s == null) return key;
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, function (m, name) {
      return vars[name] == null ? m : String(vars[name]);
    });
  }

  function days(kind) { return (DAYS[get()] || DAYS[DEFAULT])[kind || 'short']; }
  function locale() { return LOCALES[get()] || LOCALES[DEFAULT]; }

  /* Static markup carries data-i18n / data-i18n-ph / data-i18n-aria. */
  function applyStatic(root) {
    var scope = root || document;
    Array.prototype.forEach.call(scope.querySelectorAll('[data-i18n]'), function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    Array.prototype.forEach.call(scope.querySelectorAll('[data-i18n-ph]'), function (el) {
      el.placeholder = t(el.getAttribute('data-i18n-ph'));
    });
    Array.prototype.forEach.call(scope.querySelectorAll('[data-i18n-aria]'), function (el) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
  }

  return {
    available: ['en', 'es'],
    get: get,
    set: set,
    t: t,
    days: days,
    locale: locale,
    applyStatic: applyStatic
  };
})();
