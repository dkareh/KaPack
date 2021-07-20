// require("utils.js"); // $ is exported in window object so no need to make variable.
import "utils.js";

var detailsModal = $("#details-modal");
$.all(".card__details-btn").forEach(function (btn) {
    var cardWrapper = btn.parentElement;
    btn.addEventListener("click", function () {
        detailsModal.classList.add("modal--visible");
        document.body.classList.add("modal-visible");

        var modalValues = detailsModal.querySelectorAll(".modal__value");
        modalValues[0].textContent = cardWrapper.querySelector(".card__title").textContent;
        modalValues[1].textContent = cardWrapper.querySelector(".card__author").textContent;
    });
});
function modalFromCloseBtn(closeBtn) {
    var element = closeBtn;
    while (!element.classList.contains("modal")) {
        element = element.parentElement;
    }
    return element;
}
$.all(".modal__close-btn").forEach(function (closeBtn) {
    closeBtn.addEventListener("click", function () {
        modalFromCloseBtn(closeBtn).classList.remove("modal--visible");
        document.body.classList.remove("modal-visible");
    });
});
function cardFromThumbnail(thumbnail) {
    var element = thumbnail;
    while (!element.classList.contains("card")) {
        element = element.parentElement;
    }
    return element;
}
var postModal = $("#post-modal");
$.all(".card__thumbnail").forEach(function (thumbnail) {
    var card = cardFromThumbnail(thumbnail);
    thumbnail.addEventListener("click", function () {
        postModal.classList.add("modal--visible");
        document.body.classList.add("modal-visible");

        postModal.querySelector(".modal__title").textContent = card.querySelector(".card__title").textContent;

        postModal.querySelector(".modal__subtitle").textContent = card.querySelector(".card__author").textContent;
    });
});
