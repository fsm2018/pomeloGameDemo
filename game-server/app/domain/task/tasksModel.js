exports.buildTasks = function (taskConfigs) {
    let tasks = {};
    for (let key in taskConfigs) {
        if (taskConfigs.hasOwnProperty(key)) {
            let task = taskConfigs[key];
            if (key == 1 || key == 2) {
                tasks[key] = {};
                tasks[key].num = task.num;
                tasks[key].reclv_u = task.reclv_u;
            }
        }
    }
    return tasks;
};
