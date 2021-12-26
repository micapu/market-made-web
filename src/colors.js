import {createMuiTheme} from '@material-ui/core';

export const themeOptions = createMuiTheme({
    palette: {
        type: 'dark',
        primary: {
            main: '#0ecc8d',
            mainAccented: '#0a7150',
            dark: '#42f9d1',
            light: '#12946c',
        },
        secondary: {
            main: '#717581',
            light: '#bcbcc3',
            dark: '#343C54',
        },
        background: {
            default: '#01081e',
        },
        error: {
            main: "#ff0000",
            accented: "#8d3b3b"
        },
        sell: "#ff2727",
        buy: "#61ff27"
    },
});