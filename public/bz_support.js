/********************
  The purpose of this file is to hold functions we need from Canvas
  controllers that cannot be put in bz_custom.js due to order-of-load
  dependencies.
********************/

/*
  This function is responsible for loading and setting event handlers
  for the magic fields (retained data feature) used in the WYSIWYG
  editor.

  It is called by Canvas on its after render event, which happens AFTER
  window.onload, but BEFORE bz_custom.js is loaded - meaning this function
  needs to be available separately.

  Flow:
    1. canvas loads
    2. this file loads, making the function available
    3. Canvas coffeecript runs, which can call this function
    4. bz_custom.js runs
    5. bottom scripts in view html run, which can also call thi
*/
function bzRetainedInfoSetup() {
  function bzChangeRetainedItem(ta, value) {
    if(ta.tagName == "INPUT" && ta.getAttribute("type") == "checkbox")
      ta.checked = (value == "yes") ? true : false;
    else if(ta.tagName == "INPUT" && ta.getAttribute("type") == "radio")
      ta.checked = (value == ta.value) ? true : false;
    else if(ta.tagName == "INPUT" || ta.tagName == "TEXTAREA")
      ta.value = value;
    else
      ta.textContent = value;
  }

  if(window.ENV && ENV.current_user) {
    var names = document.querySelectorAll(".bz-user-name");
    for(var i = 0; i < names.length; i++) {
      var element = names[i];
      element.className = "bz-user-name-showing";
      element.textContent = ENV.current_user.display_name;
    }
  }

  var textareas = document.querySelectorAll("[data-bz-retained]");
  for(var i = 0; i < textareas.length; i++) {
    (function(ta) {
      var name = ta.getAttribute("data-bz-retained");

      if(ta.className.indexOf("bz-retained-field-setup") != -1)
        return; // already set up, no need to redo

      if(ta.tagName == "IMG") {
        // this is a hack so the editor will not allow text inside:
        // the field pretends to be an image in that context. But, when
        // it is time to display it, we want to switch back to being an
        // ordinary span.
        var span = document.createElement("span");
        span.className = ta.className;
        span.setAttribute("data-bz-retained", ta.getAttribute("data-bz-retained"));
        ta.parentNode.replaceChild(span, ta);
        ta = span;
      }

      var save = function() {
        var http = new XMLHttpRequest();
        http.open("POST", "/bz/user_retained_data", true);
        var value = ta.value;
        if(ta.getAttribute("type") == "radio")
          if(!ta.checked)
            return; // we only want to actually save the one that is checked
        if(ta.getAttribute("type") == "checkbox")
          value = ta.checked ? "yes" : "";
        var data = "name=" + encodeURIComponent(name) + "&value=" + encodeURIComponent(value);
        http.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        http.send(data);

        // we also need to update other views on the same page
        var textareas = document.querySelectorAll("[data-bz-retained]");
        for(var idx = 0; idx < textareas.length; idx++) {
            var item = textareas[idx];
            if(item == ta)
              continue;
            if(item.getAttribute("data-bz-retained") == name)
              bzChangeRetainedItem(item, value);
        }
      };

      ta.className += " bz-retained-field-setup";
      ta.addEventListener("change", save);

      var http = new XMLHttpRequest();
      // cut off json p stuff
      http.onload = function() { bzChangeRetainedItem(ta, http.responseText.substring(9)); };
      http.open("GET", "/bz/user_retained_data?name=" + encodeURIComponent(name), true);
      http.send();
    })(textareas[i]);
  }
}

if(window != window.top) {
  // we are in an iframe... strip off magic
  document.getElementsByTagName("html")[0].className += " bz-in-iframe";
}


function getInnerHtmlWithMagicFieldsReplaced(ele) {
  // we need to copy the textarea values into the html
  // text because otherwise cloneNode will discard it, and
  // the info won't be copied to the submission
  var ta = ele.querySelectorAll("textarea");
  for(var i = 0; i < ta.length; i++)
  	ta[i].textContent = ta[i].value;

  var html = ele.cloneNode(true);
  var magicFields = html.querySelectorAll("[data-bz-retained]");
  for(var i = 0; i < magicFields.length; i++) {
    var o = magicFields[i];
    var n;
    if(o.tagName == "TEXTAREA") {
      n = document.createElement("div");
      var h = o.value.
        replace("&", "&amp;").
        replace("\"", "&quot;").
        replace("<", "&lt;").
        replace("\n", "<br />");
      n.innerHTML = h;
    } else if(o.tagName == "INPUT" && o.getAttribute("type") == "checkbox") {
      n = document.createElement("span");
      n.textContent = o.checked ? "[X]" : "[ ]";
    } else if(o.tagName == "INPUT" && o.getAttribute("type") == "radio") {
      n = document.createElement("span");
      n.textContent = o.checked ? "[O]" : "[ ]";
    } else {
      n = document.createElement("span");
      n.textContent = o.value;
    }
    n.className = "bz-retained-field-replaced";
    o.parentNode.replaceChild(n, o);
  }

  return "<div class=\"bz-magic-field-submission\">" + html.innerHTML + "</div>";
}

function copyAssignmentDescriptionIntoAssignmentSubmission() {
  var desc = document.querySelector("#assignment_show .description");

  var html = getInnerHtmlWithMagicFieldsReplaced(desc);

  var bodHtml = tinyMCE.get("submission_body");
  if(bodHtml)
    bodHtml.setContent(html);

  var bod = document.getElementById("submission_body");
  bod.value = html;
}

// this is called in the canvas file public/javascripts/submit_assignment.js
// to be a custom validator
function validateMagicFields() {
  var list = document.querySelectorAll("#assignment_show .description input[type=text][data-bz-retained], #assignment_show .description input[type=url][data-bz-retained], #assignment_show .description textarea[data-bz-retained]");
  for(var a = 0; a < list.length; a++) {
    if(list[a].value == "") {
      alert('You have incomplete fields in this project. Go back and complete them before submitting.');
      list[a].focus();
      return false;
    }
  }

  return true;
}

function prepareAssignmentSubmitWithMagicFields() {
  // only do this if we put magic field editors in the assignment
  if(!document.querySelector("#assignment_show .description input[data-bz-retained], #assignment_show .description textarea[data-bz-retained]"))
    return;

  var as = document.querySelector("#assignment_show .description");
  as.className += " bz-magic-field-assignment";

  var holder = document.getElementById("submit_assignment");
  holder.className += " bz-magic-field-submit";

  // going to hide the UI
  var tab = document.querySelector("#submit_assignment_tabs li > a.submit_online_text_entry_option");
  if(tab)
    tab.parentNode.style.display = "none";

  var tabcontent = document.querySelector("#submit_assignment_online_text_form_holder");
  if(tabcontent) {
    tabcontent.style.display = "none";

    copyAssignmentDescriptionIntoAssignmentSubmission(); // copy it initially
  }

  // and copy it again on submit in case it changed in the mean time...
  var form = document.getElementById("submit_online_text_entry_form");
  if(form)
  form.addEventListener("submit", function(event) {
    copyAssignmentDescriptionIntoAssignmentSubmission();
  }, true);
}

/* We need instant survey here to ensure it is loaded before the
   canvas JS to avoid undefined function problems */
function bzActivateInstantSurvey(magic_field_name) {
        var i = document.getElementById("instant-survey");
	if(!i) return;

	// adjust styles of the container to make room  (see CSS)
	var msf = document.querySelector(".module-sequence-footer");
	var originalMsfButtonClass = msf.className;
	msf.className += ' has-instant-survey';

	// discourage clicking of next without answering first...
	var nb = document.querySelector(".bz-next-button");
	var originalNextButtonClass = nb.className;
	nb.className += ' discouraged';

	// move the survey from the hidden body to the visible footer
        var h = document.getElementById("instant-survey-holder");
        h.innerHTML = "";
        h.appendChild(i.parentNode.removeChild(i));

	var count = h.querySelectorAll("input").length;
	if(count < 3)
		msf.className += ' has-short-instant-survey';
	else if(count == 3)
		msf.className += ' has-3-instant-survey';
	else if(count == 4)
		msf.className += ' has-4-instant-survey';

	// react to survey click - save and encourage hitting the next button.

	var save = function(value) {
		var http = new XMLHttpRequest();
		http.open("POST", "/bz/user_retained_data", true);
		var data = "name=" + encodeURIComponent(magic_field_name) + "&value=" + encodeURIComponent(value) + "&from=" + encodeURIComponent(location.href);
		http.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

		// encourage next clicking again once they are saved
		http.onload = function() {
			nb.className = originalNextButtonClass;
          		var h = document.getElementById("instant-survey-holder");
			$(h).hide("slow");
			// shrinks the container...
			msf.className = originalMsfButtonClass;
		};

		http.send(data);
	};

	var inputs = i.querySelectorAll("input");
	for(var a = 0; a < inputs.length; a++) {
		inputs[a].onchange = function() {
			save(this.value);
		};
	}
}

function bzInitializeInstantSurvey() {
	// only valid on wiki pages
	if(ENV == null || ENV["WIKI_PAGE"] == null || ENV["WIKI_PAGE"].page_id == null)
		return;

	// if there's no survey in the document, don't need to query.
        var i = document.getElementById("instant-survey");
        if(!i)
	  return;

	// show the button for editors (if present) if a survey exists
	var ssrbtn = document.getElementById("see-survey-results-button");
	if(ssrbtn)
	  ssrbtn.style.display = '';


	// our key in the user magic field data where responses are stored
	var name = "instant-survey-" + ENV["WIKI_PAGE"].page_id;

	// load the value first. If it is already set, no need to show -
	// instant survey is supposed to only be done once.

	var http = new XMLHttpRequest();
	// cut off json p stuff
	http.onload = function() {
		var value = http.responseText.substring(9);
		if(value == null || value == "")
			bzActivateInstantSurvey(name);
	};
	http.open("GET", "/bz/user_retained_data?name=" + encodeURIComponent(name), true);
	http.send();

}

function BZ_ModalDialog(titleString, bodyElement, onOK) {
  var holder = document.createElement("div");
  holder.setAttribute("id", "bz-fullscreen_modal");
  var inner = document.createElement("div");
  holder.appendChild(inner);

  var title = document.createElement("h1");
  title.textContent = titleString;
  inner.appendChild(title);

  var bodyHolder = document.createElement("div");
  bodyHolder.className = "bz-fullscreen_modal-body_holder";
  inner.appendChild(bodyHolder);

  var buttonsHolder = document.createElement("div");
  buttonsHolder.className = "bz-fullscreen_modal-buttons_holder";
  inner.appendChild(buttonsHolder);

  var cancelButton = document.createElement("button");
  cancelButton.setAttribute("type", "button");
  cancelButton.className = "bz-fullscreen_modal-cancel_button";
  cancelButton.textContent = "Cancel";
  cancelButton.onclick = function() {
    document.body.removeChild(holder);
  };
  buttonsHolder.appendChild(cancelButton);

  var okButton = document.createElement("button");
  okButton.setAttribute("type", "button");
  okButton.className = "bz-fullscreen_modal-ok_button";
  okButton.textContent = "OK";
  okButton.onclick = function() {
    onOK();
    document.body.removeChild(holder);
  };
  buttonsHolder.appendChild(okButton);

  document.body.appendChild(holder);

  bodyHolder.appendChild(bodyElement);
}

var BZ_MasterBankCourseId = 1;

function BZ_SetupMasterPageClone(page_id) {
    var req = new XMLHttpRequest();
    req.open("GET", "/api/v1/courses/"+BZ_MasterBankCourseId+"/pages", true);
    req.onload = function(e) {
      if(req.status == 200) {
        var obj = JSON.parse(req.responseText.substring(9));
        var select = document.createElement("select");
        for(var i = 0; i < obj.length; i++) {
          var option = document.createElement("option");
          option.setAttribute("value", obj[i].page_id);
          option.textContent = obj[i].title;
          select.appendChild(option);
        }

        var div = document.createElement("div");
        var p = document.createElement("p");
        p.textContent = "Warning: This will erase all existing content and replace it with the bank content!";
        div.appendChild(p);
        div.appendChild(select);

        BZ_ModalDialog("Choose a page to clone", div, function() {
          var pid = select.options[select.selectedIndex].value;
          BZ_SetCloneMasterPage(page_id, pid);
        });

      } else {
        console.log(req.status);
        alert("Failure to load: " + req.status);
      }
    };
    req.send('');

}

function BZ_DetachFromMasterPage(page_id) {
  BZ_SetCloneMasterPage(page_id, '');
}

function BZ_SetCloneMasterPage(page_id, new_master) {
    var req = new XMLHttpRequest();
    var data = new FormData();
    data.append("utf8", "\u2713");
    data.append("authenticity_token", BZ_AuthToken);
    data.append("wiki_page[clone_of_id]", new_master);
    req.open("PUT", "/api/v1/courses/"+BZ_MasterBankCourseId+"/pages/" + page_id, true);
    req.onload = function(e) {
      if(req.status == 200) {
        var obj = JSON.parse(req.responseText);

        location.reload();
      } else {
        console.log(req.status);
        alert("Failure to save: " + req.status + " on " + page_id);
      }
    };
    req.send(data);

}

function BZ_GoToMasterPage(master_page_id) {
    var req = new XMLHttpRequest();
    req.open("GET", "/api/v1/courses/"+BZ_MasterBankCourseId+"/pages/" + master_page_id, true);
    req.onload = function(e) {
      if(req.status == 200) {
        var obj = JSON.parse(req.responseText.substring(9));

        location.href = "/courses/" + BZ_MasterBankCourseId + "/pages/" + obj.url;
      } else {
        console.log(req.status);
        alert("Failure to load: " + req.status);
      }
    };
    req.send('');
}
