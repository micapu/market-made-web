import { createMuiTheme } from '@material-ui/core';

export const themeOptions = createMuiTheme({
    palette: {
        type: 'dark',
        primary: {
            main: '#0ecc8d',
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
        sell:"#ff2727",
        buy:"#61ff27"
    },
});