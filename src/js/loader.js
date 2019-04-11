var qdots = ["", ".", "..", "..."];
var loaderAnimation;
var hideLoader;

window.addEventListener('load', function () {
    var loader = document.querySelector(".loader"),
        context = loader.getContext('2d');
    hideLoader = function () {
        loader.classList.add("loader--hidden");
    }

    function resize() {
        loader.width = window.innerWidth;
        loader.height = window.innerHeight;
    } resize();

    window.addEventListener('resize', resize);


    function rad(deg) {
        return (deg * 0.0174532925);
    }

    function deg(rad) {
        return (rad * 57.2957795);
    }

    function test(time) {
        var x = .5 + loader.width / 2,
            y = .5 + loader.height / 2,
            d = (((time || Date.now()) / 3) % 720),
            text, m;

        context.lineCap = 'round';
        context.lineWidth = 3;
        context.font = '700 14px VCR OCD Mono';
        context.textBaseline = 'middle';

        context.fillStyle = 'rgba(255,255,255,1)';
        context.fillRect(0, 0, loader.width, loader.height);
        context.beginPath();
        if (d < 360) {
            context.arc(x, y, 50, 0, rad(d));
        } else {
            context.arc(x, y, 50, rad(d - 360), 0);
        }
        context.strokeStyle = context.fillStyle = '#000000';
        context.stroke();
        context.closePath();

        text = 'LOADING', m = context.measureText(text);
        context.fillText(text + qdots[Math.floor(d / 180)], (x - (m.width / 2)), y);

        loaderAnimation = requestAnimationFrame(test);
    }

    test();
})

export { loaderAnimation, hideLoader };