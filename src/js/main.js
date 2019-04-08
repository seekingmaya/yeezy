import "../scss/main.scss";
import "./vh-fix";
import "./3dmodel";
import * as model from "./3dmodel";

window.addEventListener("load", function () {
  let container = document.querySelector(".container");

  let navs = document.querySelectorAll(".nav__item");

  let imgWrapper = document.querySelector(".purchase__images");

  let images = document.querySelectorAll(".purchase__img");

  let video = document.querySelector(".trailer__video");

  let mobileLandscape = window.matchMedia("(max-width: 767px) and (orientation: landscape)");
  let mobilePortrait = window.matchMedia("(max-width: 599px) and (orientation: portrait)");


  mobileLandscape.addListener(landscapeHandler);
  mobilePortrait.addListener(portraitHandler);

  function landscapeHandler(evt) {
    if (evt.matches) {
      model.stopAnimation();
      model.idleAnimation();
    }
  }

  function portraitHandler(evt) {
    let current = container.dataset.active;
    if (evt.matches && current != "yeezy") {
      model.stopAnimation();
    }
  }


  navs.forEach(nav => {
    nav.addEventListener("click", () => {
      let current = container.dataset.active;

      if (nav.dataset.nav != current) {
        setNavigation(nav.dataset.nav, current);
        container.dataset.active = nav.dataset.nav;

      }
    });
  });

  images.forEach((img, index) => {
    img.addEventListener("click", () => {

      imgWrapper.dataset.img = index >= images.length - 1 ? 1 : index + 2;

    });
  });

  video.src = video.dataset.src;

  video.addEventListener('click', function () {
    if (video.paused || video.ended) {
      video.play();
    }
    else {
      video.pause();
    }
  })

  function setNavigation(nav, current) {
    if (nav != "yeezy") {
      model.stopAnimation();
    }
    else {
      model.stopAnimation();
      model.idleAnimation();
    }
    if (current == "trailer" && (!video.paused || !video.ended)) {
      video.pause();
    }
    else if (nav == "trailer" && current != nav) {
      video.currentTime = 0;
      video.play();
    }
  }

});



