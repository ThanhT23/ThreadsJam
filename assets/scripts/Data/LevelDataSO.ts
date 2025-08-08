interface ICellData {
    x: number;
    t: number;
    type: string;
}

interface IPictureStageData {
    part: number;
}
interface ILevelStageData {
    part: number;
    cells: ICellData[];
}

export class LevelDataSO {
    //
}
