// Learn TypeScript:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/life-cycle-callbacks.html

export default class Bezier {
    private _runTime: number = 0;
    private _pointArr: cc.Vec2[] = [];
    private _pointLists: cc.Vec2[] = [];
    private prevPos = null;
    private totalLength = 0;
    private currentRunTime = 0;
    constructor(t, e) {
        void 0 === e && (e = 2), (this._runTime = e), (this._pointArr = t);
    }
    resetData() {
        (this._pointLists = []),
            (this.totalLength = this.currentRunTime = 0),
            (this.prevPos = {
                x: this._pointArr[0].x,
                y: this._pointArr[0].y,
                length: 0,
            });
    }
    factorial(t) {
        for (var e = 1, o = 1; o <= t; o++) e *= o;
        return e;
    }
    ComputeBezier(t, e) {
        var o = this,
            r = this.currentRunTime / e,
            i = 0,
            n = 0,
            c = this._pointArr.length - 1;
        this._pointArr.forEach(function (t, e) {
            e
                ? ((i +=
                      (o.factorial(c) / o.factorial(e) / o.factorial(c - e)) *
                      t.x *
                      Math.pow(1 - r, c - e) *
                      Math.pow(r, e)),
                  (n +=
                      (o.factorial(c) / o.factorial(e) / o.factorial(c - e)) *
                      t.y *
                      Math.pow(1 - r, c - e) *
                      Math.pow(r, e)))
                : ((i += t.x * Math.pow(1 - r, c - e) * Math.pow(r, e)),
                  (n += t.y * Math.pow(1 - r, c - e) * Math.pow(r, e)));
        });
        var s = Math.sqrt(
                Math.pow(this.prevPos.x - i, 2) +
                    Math.pow(this.prevPos.y - n, 2)
            ),
            p = cc.v2(i, n);
        (p.length = s),
            this._pointLists.push(p),
            (this.prevPos = p),
            (this.totalLength += s),
            (this.currentRunTime += t);
    }
    ComputeBezier3(t, e) {
        var o,
            r,
            i = this.currentRunTime / e,
            n = (this._pointArr.length, this._pointArr[0]),
            c = this._pointArr[1],
            s = this._pointArr[2],
            p = this._pointArr[3];
        (o =
            n.x * (1 - i) * (1 - i) * (1 - i) +
            3 * c.x * i * (1 - i) * (1 - i) +
            3 * s.x * i * i * (1 - i) +
            p.x * i * i * i),
            (r =
                n.y * (1 - i) * (1 - i) * (1 - i) +
                3 * c.y * i * (1 - i) * (1 - i) +
                3 * s.y * i * i * (1 - i) +
                p.y * i * i * i);
        var a = Math.sqrt(
                Math.pow(this.prevPos.x - o, 2) +
                    Math.pow(this.prevPos.y - r, 2)
            ),
            h = cc.v2(o, r);
        (h.length = a),
            this._pointLists.push(h),
            (this.prevPos = h),
            (this.totalLength += a),
            (this.currentRunTime += t);
    }
    getPoints(t) {
        void 0 === t && (t = 200), this.resetData();
        for (var e = this._runTime / t, o = 0, r = t + 1; o < r; o++)
            this._pointArr.length > 3
                ? this.ComputeBezier3(e, this._runTime)
                : this.ComputeBezier(e, this._runTime);
        return this._pointLists;
    }
    getCurveLength() {
        return this.totalLength;
    }
}
