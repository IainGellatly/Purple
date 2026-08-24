let inputElement = null;
let containerElement = null;
let targetElement = null;

let recognition = null;
let debounceTimer = null;
let speechTimer = null;
let listening = false;

let backspaceRepeatTimer = null;
let backspaceRepeatInterval = null;
let backspaceClearTimer = null;
let backspaceHeld = false;

let currentLayout = "abc";

const layouts = {
  abc: [
    { keys: [ {t:"Q"},{t:"W"},{t:"E"},{t:"R"},{t:"T"},{t:"Y"},{t:"U"},{t:"I"},{t:"O"},{t:"P"} ] },
    { keys: [ {t:"A"},{t:"S"},{t:"D"},{t:"F"},{t:"G"},{t:"H"},{t:"J"},{t:"K"},{t:"L"} ] },
    { keys: [ {t:"Z"},{t:"X"},{t:"C"},{t:"V"},{t:"B"},{t:"N"},{t:"M"},{t:","},{t:"."} ] },
    { keys: [
    {t:"123", c:"utility toggle-btn"},
    {t:"Space", c:"spacebar"},
    {t:"⌫", c:"utility backspace-btn"}
] }
  ],
  numbers: [
    { keys: [ {t:"1"},{t:"2"},{t:"3"},{t:"4"},{t:"5"},{t:"6"},{t:"7"},{t:"8"},{t:"9"},{t:"0"} ] },
    { keys: [ {t:"-"},{t:"="},{t:"("},{t:")"},{t:"/"},{t:";"},{t:"\""},{t:","},{t:"."} ] },
    { keys: [ {t:"!"},{t:"@"},{t:"#"},{t:"$"},{t:"%"},{t:"^"},{t:"&"},{t:"*"} ] },
    { keys: [
    {t:"ABC", c:"utility toggle-btn"},
    {t:"Space", c:"spacebar"},
    {t:"⌫", c:"utility backspace-btn"}
] }
  ]
};

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;
}

const fillerWords = new Set([
    "uh",
    "um",
    "er",
    "ah",
    "hmm",
    "like",
    "you know"
]);

function haptic() {
    if ("vibrate" in navigator) {
        navigator.vibrate([12]);
    }
}

function cleanTranscript(text){
    return text
        .toLowerCase()
        .split(/\s+/)
        .filter(word=>!fillerWords.has(word))
        .join(" ")
        .replace(/\s+/g," ")
        .trim();
}

function startVoiceRecognition(){
    haptic();
    containerElement.style.display = "block";
    if(!recognition)
        return;
    switchTab("search");
    inputElement.value="";
    inputElement.dispatchEvent(new Event("input"));
    if (!listening) {
        recognition.start();
    }
}

recognition.onresult = (event) => {
    clearTimeout(debounceTimer);
    clearTimeout(speechTimer);

    // Only use the newest recognition result.
    let transcript =
        event.results[event.resultIndex][0].transcript;

    transcript = cleanTranscript(
        transcript
            .replace(/[.,!?;:]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
    );

    debounceTimer = setTimeout(() => {
        inputElement.value = transcript;
        inputElement.dispatchEvent(
            new Event("input")
        );
    }, 200);

    speechTimer = setTimeout(() => {
        recognition.stop();
    }, 4500);
};

recognition.onend=()=>{
    clearTimeout(speechTimer);
};

recognition.onerror=(e)=>{
    console.log(e.error);
};

function renderKeyboard(layoutName) {
  targetElement.innerHTML = "";
  const layout = layouts[layoutName];

  layout.forEach(rowConfig => {
    const rowDiv = document.createElement("div");
    rowDiv.className = "keyboard-row";

    rowConfig.keys.forEach(item => {
      const btn = document.createElement("button");
      btn.className = "key " + (item.c || "");
      btn.textContent = item.t;

        if (item.t === "⌫") {
            btn.addEventListener("pointerdown", startBackspaceRepeat);
            btn.addEventListener("pointerup", stopBackspaceRepeat);
            btn.addEventListener("pointercancel", stopBackspaceRepeat);

            btn.addEventListener("pointerdown", (e) => {
                btn.setPointerCapture(e.pointerId);
            });
        } else {
            btn.addEventListener("click", (e) => handleKeyPress(item.t, e));
        }
      rowDiv.appendChild(btn);
    });
    targetElement.appendChild(rowDiv);
  });
}

function deleteLastCharacter() {
    inputElement.value = inputElement.value.slice(0, -1);
    // Notify the application that the search text changed.
    inputElement.dispatchEvent(new Event("input"));
}

function startBackspaceRepeat(e) {
    e.preventDefault();
    e.stopPropagation();
    haptic();
    backspaceHeld = true;
    // Delete one character immediately.
    deleteLastCharacter();
    /*
     * Start auto-repeat after the key has been held
     * for one second.
     */
    backspaceRepeatTimer = setTimeout(() => {
        backspaceRepeatInterval = setInterval(() => {
            if (inputElement.value.length > 0) {
                deleteLastCharacter();
            }
        }, 100);
    }, 1000);

    /*
     * If the key remains held for three seconds,
     * completely clear the search field.
     */
    backspaceClearTimer = setTimeout(() => {
        if (backspaceHeld) {
            inputElement.value = "";
            inputElement.dispatchEvent(
                new Event("input")
            );
            stopBackspaceRepeat();
        }
    }, 3000);
}

function stopBackspaceRepeat() {
    backspaceHeld = false;
    clearTimeout(backspaceRepeatTimer);
    clearInterval(backspaceRepeatInterval);
    clearTimeout(backspaceClearTimer);
    backspaceRepeatTimer = null;
    backspaceRepeatInterval = null;
    backspaceClearTimer = null;
}

function handleKeyPress(key, e) {
  e.preventDefault();
  e.stopPropagation();
  haptic();

  let currentVal = inputElement.value;

  if (key === "Space") {
    inputElement.value += " ";
  } else if (key === "123") {
    currentLayout = "numbers";
    renderKeyboard("numbers");
  } else if (key === "ABC") {
    currentLayout = "abc";
    renderKeyboard("abc");
  } else if(key==="🎤"){
    startVoiceRecognition();
    return;
} else {
    inputElement.value += key.toLowerCase();
  }
  // Notify the application that the search text changed.
    inputElement.dispatchEvent(new Event("input"));
}

function initializeExploreKeyboard() {

    inputElement =
        document.querySelector("#virtual-input");

    containerElement =
        document.querySelector("#kb-container");

    targetElement =
        document.querySelector("#keyboard-stack-target");


    if (
        !inputElement ||
        !containerElement ||
        !targetElement
    ) {

        console.error(
            "Explore keyboard: required elements not found."
        );

        return;

    }


    const voiceButton =
        document.getElementById("voice-button");


    voiceButton.addEventListener(
        "click",
        (e) => {

            e.preventDefault();

            startVoiceRecognition();

        }
    );


    inputElement.addEventListener(
        "click",
        openKeyboard
    );


    document.addEventListener(
        "click",
        (event) => {

            if (
                !inputElement.contains(event.target) &&
                !containerElement.contains(event.target)
            ) {

                closeKeyboard();

            }

        }
    );
}

function openKeyboard(e) {
    e.preventDefault();
    renderKeyboard(currentLayout);
    // Always return to the Search tab when typing begins.
    if (typeof switchTab === "function") {
        switchTab("search");
    }
    containerElement.style.display = "block";
}

function closeKeyboard() {
  containerElement.style.display = "none";
}

function updateVoiceButtons(listening){

    document
        .querySelectorAll(".mic-btn,#voice-button")
        .forEach(button=>{
            if(listening)
                button.classList.add("listening","mic-listening");
            else
                button.classList.remove("listening","mic-listening");
        });
}

recognition.onstart = () => {
    listening = true;
    updateVoiceButtons(true);
};

recognition.onend = () => {
    listening = false;
    clearTimeout(speechTimer);
    updateVoiceButtons(false);
};
