import "../scss/main.scss";
import "./vh-fix";
import "./3dmodel";

window.addEventListener("load", function () {
  let container = document.querySelector(".container");

  let navs = document.querySelectorAll(".nav__item");

  let imgWrapper = document.querySelector(".purchase__images");

  let images = document.querySelectorAll(".purchase__img");

  let video = document.querySelector(".trailer__video");

  navs.forEach(nav => {
    nav.addEventListener("click", () => {
      let current = container.dataset.active;

      if (nav.dataset.nav != current) {
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

});
