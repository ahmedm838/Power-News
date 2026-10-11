// Display dates consistently while retaining ISO values for the search code.
function initializeDatePickers() {
  ["dateFrom", "dateTo"].forEach(function(id) {
    var input = document.getElementById(id);
    var picker = flatpickr(input, {
      altInput: true,
      altFormat: "d/m/Y",
      dateFormat: "Y-m-d",
      ariaDateFormat: "j F Y",
      disableMobile: true,
      maxDate: input.max || null,
      locale: { firstDayOfWeek: 1 }
    });
    picker.altInput.id = id + "Display";
    picker.altInput.placeholder = "DD/MM/YYYY";
    document.querySelector('label[for="' + id + '"]').htmlFor = picker.altInput.id;
  });
}

function setDateFieldValue(input, value) {
  if (input._flatpickr) {
    input._flatpickr.set("maxDate", input.max || null);
    input._flatpickr.setDate(value, false, "Y-m-d");
  } else {
    input.value = value;
  }
}
