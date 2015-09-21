var glm = require('gl-matrix');

module.exports = Object.assign(Object.create(null), {
    stack: [],
    push (mat) {
        if (this.stack.length !== 0){
            mat = glm.mat4.mul(mat4(), this.get(), mat);
        }
        this.stack.push(mat);
    },

    pop (){
        return this.stack.pop();
    },

    get(){
        return this.stack[this.stack.length-1];
    }
});